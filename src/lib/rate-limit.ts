import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";

/**
 * Fixed-window rate limiting backed by Postgres, so every serverless instance shares
 * the same counters. One atomic upsert per check: it starts a new window when the old
 * one has expired, otherwise increments.
 *
 *   await limit("login:ip", ip, 20, 15 * 60);   // 20 attempts / 15 min per IP
 */
export async function limit(scope: string, id: string, max: number, windowSeconds: number) {
  // Hash the identifier so raw IPs and emails aren't stored.
  const key = `${scope}:${createHash("sha256").update(id).digest("base64url").slice(0, 32)}`;
  // Timestamps are stored as UTC without a zone (Prisma's convention), so use UTC "now"
  // explicitly: plain now() would follow the database server's time zone.
  const [row] = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("key", "windowStart", "count") VALUES (${key}, (now() AT TIME ZONE 'UTC'), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count"       = CASE WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}) THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < (now() AT TIME ZONE 'UTC') - make_interval(secs => ${windowSeconds}) THEN (now() AT TIME ZONE 'UTC') ELSE "RateLimit"."windowStart" END
    RETURNING "count", "windowStart"`;
  if (row.count > max) {
    const retry = Math.max(1, Math.ceil((row.windowStart.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
    throw new ApiError(429, "RATE_LIMITED", `Too many attempts. Try again in ${retry < 90 ? `${retry} seconds` : `${Math.ceil(retry / 60)} minutes`}`);
  }
}

/** Client IP on Vercel (x-forwarded-for is set by the platform, first entry = client). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

/** Occasional cleanup of expired counters (called from low-traffic paths). */
export async function sweepRateLimits() {
  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 86_400_000) } } });
}

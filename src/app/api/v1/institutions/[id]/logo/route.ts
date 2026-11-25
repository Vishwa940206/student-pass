import { db } from "@/lib/db";

/** Institution logo. Versioned URL (?v=updatedAt), so it can be cached for a long time. */
export async function GET(_req: Request, ctx: RouteContext<"/api/v1/institutions/[id]/logo">) {
  const { id } = await ctx.params;
  const i = await db.institution.findUnique({ where: { id }, select: { logo: true, logoType: true } });
  if (!i?.logo || !i.logoType) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(i.logo), {
    headers: {
      "content-type": i.logoType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

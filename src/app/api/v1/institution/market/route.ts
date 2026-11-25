import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { ADMISSIONS, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";

const DAY = 86_400_000;

/**
 * Market intelligence from the institution's own enquiries: which programmes, districts and
 * channels demand is coming from, last 90 days vs the 90 before, plus a 6-month trend.
 */
export const GET = handler(async () => {
  const { institutionId } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "market");
  const now = Date.now();
  const recent = { gte: new Date(now - 90 * DAY) }, prior = { gte: new Date(now - 180 * DAY), lt: new Date(now - 90 * DAY) };

  const [progNow, progPrev, programmes, districts, sources, monthly] = await Promise.all([
    db.lead.groupBy({ by: ["programmeId"], where: { institutionId, createdAt: recent }, _count: true }),
    db.lead.groupBy({ by: ["programmeId"], where: { institutionId, createdAt: prior }, _count: true }),
    db.programme.findMany({ where: { institutionId }, select: { id: true, name: true, open: true } }),
    db.lead.groupBy({ by: ["district"], where: { institutionId, createdAt: recent, district: { not: null } }, _count: true, orderBy: { _count: { district: "desc" } }, take: 12 }),
    db.lead.groupBy({ by: ["source"], where: { institutionId, createdAt: recent }, _count: true }),
    db.$queryRaw<{ month: Date; programmeId: string | null; n: bigint }[]>`
      SELECT date_trunc('month', "createdAt" AT TIME ZONE 'Asia/Colombo') AS month, "programmeId", count(*) AS n
      FROM "Lead" WHERE "institutionId" = ${institutionId} AND "createdAt" >= now() - interval '6 months'
      GROUP BY 1, 2 ORDER BY 1`,
  ]);

  const name = new Map(programmes.map((p) => [p.id, p.name]));
  const prev = new Map(progPrev.map((r) => [r.programmeId, r._count]));
  const demand = progNow
    .map((r) => ({ programmeId: r.programmeId, name: r.programmeId ? name.get(r.programmeId) ?? "—" : "Undecided", count: r._count, prior: prev.get(r.programmeId) ?? 0 }))
    .sort((a, b) => b.count - a.count);
  const top = demand.slice(0, 5).map((d) => d.programmeId);
  const months = [...new Set(monthly.map((m) => m.month.toISOString()))];
  const trend = top.map((pid) => ({
    name: pid ? name.get(pid) ?? "—" : "Undecided",
    points: months.map((m) => Number(monthly.find((r) => r.month.toISOString() === m && r.programmeId === pid)?.n ?? 0)),
  }));
  const total = demand.reduce((n, d) => n + d.count, 0);

  return json({
    total,
    demand,
    noEnquiries: programmes.filter((p) => p.open && !progNow.some((r) => r.programmeId === p.id)).map((p) => p.name),
    districts: districts.map((d) => ({ district: d.district, count: d._count })),
    sources: sources.map((s) => ({ source: s.source, count: s._count })).sort((a, b) => b.count - a.count),
    months,
    trend,
  });
});

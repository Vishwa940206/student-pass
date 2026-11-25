import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { ADMISSIONS, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";

const STAGES = ["NEW", "CONTACTED", "COUNSELLING", "APPLIED", "OFFER", "ENROLLED"] as const;

/** Admissions + campus analytics for the institution. `days` = lookback for leads (default 180). */
export const GET = handler(async (req) => {
  const { institutionId } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "analytics");
  const days = Math.min(730, Math.max(7, Number(new URL(req.url).searchParams.get("days")) || 180));
  const since = new Date(Date.now() - days * 86_400_000);
  const where = { institutionId, createdAt: { gte: since } };

  const [byStage, bySourceStage, byCounsellorStage, weekly, staff, campus] = await Promise.all([
    db.lead.groupBy({ by: ["stage"], where, _count: true }),
    db.lead.groupBy({ by: ["source", "stage"], where, _count: true }),
    db.lead.groupBy({ by: ["counsellorId", "stage"], where, _count: true }),
    db.$queryRaw<{ week: Date; enquiries: bigint; applications: bigint }[]>`
      WITH weeks AS (
        SELECT generate_series(date_trunc('week', now() AT TIME ZONE 'Asia/Colombo') - interval '11 weeks',
                               date_trunc('week', now() AT TIME ZONE 'Asia/Colombo'), interval '1 week') AS week
      )
      SELECT w.week,
        (SELECT count(*) FROM "Lead" l WHERE l."institutionId" = ${institutionId}
           AND date_trunc('week', l."createdAt" AT TIME ZONE 'Asia/Colombo') = w.week) AS enquiries,
        (SELECT count(*) FROM "Application" a WHERE a."institutionId" = ${institutionId}
           AND date_trunc('week', a."createdAt" AT TIME ZONE 'Asia/Colombo') = w.week) AS applications
      FROM weeks w ORDER BY w.week`,
    db.institutionStaff.findMany({ where: { institutionId }, select: { user: { select: { id: true, name: true } } } }),
    Promise.all([
      db.studentProfile.count({ where: { institutionId, verificationStatus: "VERIFIED" } }),
      db.eventRsvp.count({ where: { event: { institutionId }, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } } }),
      db.clubMember.count({ where: { club: { institutionId } } }),
      db.course.findMany({
        where: { institutionId }, orderBy: { code: "asc" },
        select: { code: true, name: true, _count: { select: { enrolments: true } }, assignments: { select: { maxMarks: true, grades: { select: { marks: true } } } } },
      }),
    ]),
  ]);

  const atLeast = (rows: { stage: string; _count: number }[], i: number) =>
    rows.filter((r) => STAGES.indexOf(r.stage as (typeof STAGES)[number]) >= i).reduce((n, r) => n + r._count, 0);
  const funnel = STAGES.map((s, i) => ({ stage: s, count: atLeast(byStage, i) }));

  const group = <K extends string>(rows: ({ stage: string; _count: number } & Record<K, string | null>)[], key: K) => {
    const out = new Map<string | null, { total: number; contacted: number; applied: number; enrolled: number }>();
    for (const r of rows) {
      const g = out.get(r[key]) ?? { total: 0, contacted: 0, applied: 0, enrolled: 0 };
      const i = STAGES.indexOf(r.stage as (typeof STAGES)[number]);
      g.total += r._count;
      if (i >= 1) g.contacted += r._count;
      if (i >= 3) g.applied += r._count;
      if (i >= 5) g.enrolled += r._count;
      out.set(r[key], g);
    }
    return out;
  };
  const sources = [...group(bySourceStage, "source")].map(([source, g]) => ({ source, ...g })).sort((a, b) => b.total - a.total);
  const names = new Map(staff.map((s) => [s.user.id, s.user.name]));
  const counsellors = [...group(byCounsellorStage, "counsellorId")]
    .map(([id, g]) => ({ id, name: id ? names.get(id) ?? "Former staff" : "Unassigned", ...g }))
    .sort((a, b) => b.total - a.total);

  const [verified, rsvps30, clubMembers, courses] = campus;
  return json({
    days,
    funnel,
    weekly: weekly.map((w) => ({ week: w.week, enquiries: Number(w.enquiries), applications: Number(w.applications) })),
    sources,
    counsellors,
    campus: {
      verified, rsvps30, clubMembers,
      courses: courses.map((c) => {
        const pcts = c.assignments.flatMap((a) => a.grades.map((g) => g.marks / a.maxMarks));
        return { code: c.code, name: c.name, enrolled: c._count.enrolments, graded: pcts.length, average: pcts.length ? Math.round((100 * pcts.reduce((s, x) => s + x, 0)) / pcts.length) : null };
      }),
    },
  });
});

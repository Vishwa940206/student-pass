import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";

/** Institution portal data for the signed-in staff member's institution. */
export const GET = handler(async () => {
  const { user, institutionId, staffRole } = await requireStaff();
  const where = { institutionId };

  const [institution, students, announcements, events, clubs, courses, staff] = await Promise.all([
    db.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { id: true, name: true, shortName: true } }),
    db.studentProfile.groupBy({ by: ["verificationStatus"], where, _count: true }),
    db.announcement.findMany({
      where, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 50,
      select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
    }),
    db.event.findMany({
      where, orderBy: { startsAt: "desc" }, take: 100,
      select: { id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, capacity: true, _count: { select: { rsvps: true } } },
    }),
    db.club.findMany({ where, orderBy: { name: "asc" }, select: { id: true, name: true, description: true, _count: { select: { members: true } } } }),
    db.course.findMany({
      where, orderBy: { code: "asc" },
      select: {
        id: true, code: true, name: true, lecturer: { select: { id: true, name: true } },
        _count: { select: { enrolments: true } },
        assignments: { orderBy: { dueAt: "asc" }, select: { id: true, title: true, dueAt: true, maxMarks: true, _count: { select: { grades: true } } } },
      },
    }),
    db.institutionStaff.findMany({
      where, orderBy: { createdAt: "asc" },
      select: { staffRole: true, createdAt: true, user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const count = (s: string) => students.find((x) => x.verificationStatus === s)?._count ?? 0;
  return json({
    me: { id: user.id, name: user.name, staffRole },
    institution,
    stats: {
      verified: count("VERIFIED"), pending: count("PENDING"),
      upcomingEvents: events.filter((e) => e.startsAt > new Date()).length,
      clubMembers: clubs.reduce((n, c) => n + c._count.members, 0),
      courses: courses.length,
      enrolments: courses.reduce((n, c) => n + c._count.enrolments, 0),
    },
    announcements,
    events: events.map(({ _count, ...e }) => ({ ...e, going: _count.rsvps })),
    clubs: clubs.map(({ _count, ...c }) => ({ ...c, members: _count.members })),
    courses: courses.map(({ _count, assignments, ...c }) => ({
      ...c, enrolled: _count.enrolments,
      assignments: assignments.map(({ _count, ...a }) => ({ ...a, graded: _count.grades })),
    })),
    staff: staff.map((s) => ({ ...s.user, staffRole: s.staffRole, createdAt: s.createdAt })),
  });
});

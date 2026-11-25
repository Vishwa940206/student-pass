import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { brandingOf } from "@/lib/os/branding";

/** Everything on a verified student's Campus Life home, scoped to their institution. */
export const GET = handler(async () => {
  const { studentId, institutionId } = await requireCampusStudent();
  const now = new Date();

  const [branding, announcements, events, clubs, enrolments] = await Promise.all([
    brandingOf(institutionId),
    db.announcement.findMany({
      where: { institutionId },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 20,
      select: { id: true, title: true, body: true, pinned: true, createdAt: true, author: { select: { name: true } } },
    }),
    db.event.findMany({
      // Still running or upcoming
      where: { institutionId, OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: new Date(now.getTime() - 6 * 3600_000) } }] },
      orderBy: { startsAt: "asc" },
      take: 50,
      select: {
        id: true, title: true, description: true, location: true, startsAt: true, endsAt: true, capacity: true,
        _count: { select: { rsvps: true } },
        rsvps: { where: { studentId }, select: { studentId: true } },
      },
    }),
    db.club.findMany({
      where: { institutionId },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, description: true,
        _count: { select: { members: true } },
        members: { where: { studentId }, select: { studentId: true } },
      },
    }),
    db.enrolment.findMany({
      where: { studentId, course: { institutionId } },
      orderBy: { course: { code: "asc" } },
      select: {
        course: {
          select: {
            id: true, code: true, name: true,
            lecturer: { select: { name: true } },
            assignments: {
              orderBy: { dueAt: "asc" },
              select: {
                id: true, title: true, description: true, dueAt: true, maxMarks: true,
                grades: { where: { studentId }, select: { marks: true, feedback: true, gradedAt: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  return json({
    institution: { name: branding.displayName, shortName: branding.shortName },
    branding,
    announcements,
    events: events.map(({ _count, rsvps, ...e }) => ({ ...e, going: _count.rsvps, mine: rsvps.length > 0 })),
    clubs: clubs.map(({ _count, members, ...c }) => ({ ...c, members: _count.members, mine: members.length > 0 })),
    courses: enrolments.map(({ course: { assignments, ...c } }) => ({
      ...c,
      assignments: assignments.map(({ grades, ...a }) => ({ ...a, grade: grades[0] ?? null })),
    })),
  });
});

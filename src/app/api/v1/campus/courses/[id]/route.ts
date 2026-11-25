import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";
import { attendanceByStudent } from "@/lib/os/lms";

/** A student's view of one of their courses: published lessons with their progress, assignments, attendance. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/campus/courses/[id]">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  found(await db.enrolment.findFirst({ where: { courseId: id, studentId, course: { institutionId } } }), "Course");
  const [course, modules, assignments, att, sessions] = await Promise.all([
    db.course.findUniqueOrThrow({ where: { id }, select: { id: true, code: true, name: true, lecturer: { select: { name: true } }, institution: { select: { modules: true } } } }),
    db.courseModule.findMany({
      where: { courseId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      select: { id: true, title: true, lessons: { where: { published: true }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, body: true, url: true, progress: { where: { studentId }, select: { completedAt: true } } } } },
    }),
    db.assignment.findMany({
      where: { courseId: id }, orderBy: { dueAt: "asc" },
      select: { id: true, title: true, description: true, dueAt: true, maxMarks: true,
        grades: { where: { studentId }, select: { marks: true, feedback: true } },
        submissions: { where: { studentId }, select: { text: true, link: true, submittedAt: true } } },
    }),
    attendanceByStudent(id),
    db.attendance.findMany({ where: { studentId, session: { courseId: id } }, orderBy: { session: { date: "desc" } }, take: 20, select: { status: true, session: { select: { date: true, title: true } } } }),
  ]);
  const lms = course.institution.modules.includes("lms");
  return json({
    course: { id: course.id, code: course.code, name: course.name, lecturer: course.lecturer },
    modules: lms ? modules.map((m) => ({ ...m, lessons: m.lessons.map(({ progress, ...l }) => ({ ...l, done: progress.length > 0 })) })) : [],
    assignments: assignments.map(({ grades, submissions, ...a }) => ({ ...a, grade: grades[0] ?? null, submission: submissions[0] ?? null })),
    attendance: lms ? { pct: att.get(studentId)?.pct ?? null, recent: sessions.map((s) => ({ date: s.session.date, title: s.session.title, status: s.status })) } : null,
  });
});

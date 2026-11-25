import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { CAMPUS, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";
import { AT_RISK_ATTENDANCE, attendanceByStudent, courseIn, progressByStudent } from "@/lib/os/lms";

/** Sessions with their records, plus each learner's attendance %, lesson progress and risk flag. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/institution/courses/[id]/attendance">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  await requireModule(institutionId, "lms");
  const { id } = await ctx.params;
  await courseIn(id, institutionId);
  const [sessions, roster, att, prog] = await Promise.all([
    db.attendanceSession.findMany({
      where: { courseId: id }, orderBy: { date: "desc" }, take: 100,
      select: { id: true, date: true, title: true, records: { select: { studentId: true, status: true } } },
    }),
    db.enrolment.findMany({ where: { courseId: id }, orderBy: { student: { studentNumber: "asc" } }, select: { student: { select: { id: true, studentNumber: true, user: { select: { name: true } } } } } }),
    attendanceByStudent(id),
    progressByStudent(id),
  ]);
  return json({
    atRiskBelow: AT_RISK_ATTENDANCE,
    lessons: prog.total,
    sessions,
    learners: roster.map(({ student: s }) => {
      const a = att.get(s.id);
      const done = prog.done.get(s.id) ?? 0;
      return {
        id: s.id, studentNumber: s.studentNumber, name: s.user.name,
        attendance: a?.pct ?? null, progress: prog.total ? Math.round((100 * done) / prog.total) : null,
        atRisk: a?.pct != null && a.pct < AT_RISK_ATTENDANCE,
      };
    }),
  });
});

export const Records = z.array(z.object({ studentId: z.string().min(1), status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"]) })).max(1000);

/** Take attendance for a session. Only enrolled students can be marked. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/courses/[id]/attendance">) => {
  const { user, institutionId } = await requireStaff(...CAMPUS);
  await requireModule(institutionId, "lms");
  const { id } = await ctx.params;
  await courseIn(id, institutionId);
  const input = await body(req, z.object({ date: z.iso.date(), title: z.string().trim().min(1).max(120).default("Class"), records: Records }));
  const enrolled = new Set((await db.enrolment.findMany({ where: { courseId: id }, select: { studentId: true } })).map((e) => e.studentId));
  if (input.records.some((r) => !enrolled.has(r.studentId))) throw new ApiError(400, "NOT_ENROLLED", "Some students aren’t enrolled in this course");
  const session = await db.attendanceSession.create({
    data: {
      courseId: id, title: input.title, date: new Date(`${input.date}T03:30:00Z`), createdById: user.id, // 09:00 Colombo
      records: { create: input.records.map((r) => ({ studentId: r.studentId, status: r.status })) },
    },
    select: { id: true },
  });
  return json(session, 201);
});

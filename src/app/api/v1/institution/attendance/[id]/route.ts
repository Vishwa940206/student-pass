import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";
import { Records } from "../../courses/[id]/attendance/route";

/** Correct a session's records. */
export const PUT = handler(async (req, ctx: RouteContext<"/api/v1/institution/attendance/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const s = found(await db.attendanceSession.findFirst({ where: { id, course: { institutionId } }, select: { courseId: true } }), "Session");
  const { records } = await body(req, z.object({ records: Records }));
  const enrolled = new Set((await db.enrolment.findMany({ where: { courseId: s.courseId }, select: { studentId: true } })).map((e) => e.studentId));
  if (records.some((r) => !enrolled.has(r.studentId))) throw new ApiError(400, "NOT_ENROLLED", "Some students aren’t enrolled in this course");
  await db.$transaction([
    db.attendance.deleteMany({ where: { sessionId: id } }),
    db.attendance.createMany({ data: records.map((r) => ({ sessionId: id, ...r })) }),
  ]);
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/attendance/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const { count } = await db.attendanceSession.deleteMany({ where: { id, course: { institutionId } } });
  found(count || null, "Session");
  return json({ ok: true });
});

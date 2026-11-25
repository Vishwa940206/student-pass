import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/courses/[id]/enrolments/[studentId]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id, studentId } = await ctx.params;
  const { count } = await db.enrolment.deleteMany({ where: { courseId: id, studentId, course: { institutionId } } });
  found(count || null, "Enrolment");
  return json({ ok: true });
});

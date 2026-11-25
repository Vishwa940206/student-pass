import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

/** Deletes the course with its enrolments, assignments and grades. */
export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/courses/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const { count } = await db.course.deleteMany({ where: { id, institutionId } });
  found(count || null, "Course");
  return json({ ok: true });
});

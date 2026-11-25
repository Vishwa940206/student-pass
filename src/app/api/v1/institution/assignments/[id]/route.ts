import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/assignments/[id]">) => {
  const { institutionId } = await requireStaff();
  const { id } = await ctx.params;
  const { count } = await db.assignment.deleteMany({ where: { id, course: { institutionId } } });
  found(count || null, "Assignment");
  return json({ ok: true });
});

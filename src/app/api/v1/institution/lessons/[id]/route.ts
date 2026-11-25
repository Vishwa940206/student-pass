import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";
import { LessonInput } from "../../modules/[id]/lessons/route";

const where = (id: string, institutionId: string) => ({ id, module: { course: { institutionId } } });

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/lessons/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const p = await body(req, LessonInput.partial());
  const { count } = await db.lesson.updateMany({ where: where(id, institutionId), data: p });
  found(count || null, "Lesson");
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/lessons/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const { count } = await db.lesson.deleteMany({ where: where(id, institutionId) });
  found(count || null, "Lesson");
  return json({ ok: true });
});

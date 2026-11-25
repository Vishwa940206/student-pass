import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

const where = (id: string, institutionId: string) => ({ id, course: { institutionId } });

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/modules/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const p = await body(req, z.object({ title: z.string().trim().min(2).max(120).optional(), position: z.int().min(0).max(1000).optional() }));
  const { count } = await db.courseModule.updateMany({ where: where(id, institutionId), data: p });
  found(count || null, "Module");
  return json({ ok: true });
});

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/modules/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const { count } = await db.courseModule.deleteMany({ where: where(id, institutionId) });
  found(count || null, "Module");
  return json({ ok: true });
});

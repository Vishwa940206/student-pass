import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";
import { ProgrammeInput } from "../route";

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/programmes/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const input = await body(req, ProgrammeInput.partial());
  const { count } = await db.programme.updateMany({ where: { id, institutionId }, data: input });
  found(count || null, "Programme");
  return json({ ok: true });
});

/** Only programmes without applications can be deleted; otherwise close them. */
export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/programmes/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const p = found(await db.programme.findFirst({ where: { id, institutionId }, select: { _count: { select: { applications: true } } } }), "Programme");
  if (p._count.applications) throw new ApiError(409, "HAS_APPLICATIONS", "This programme has applications. Close it instead of deleting");
  await db.programme.delete({ where: { id } });
  return json({ ok: true });
});

import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/clubs/[id]">) => {
  const { institutionId } = await requireStaff();
  const { id } = await ctx.params;
  const { count } = await db.club.deleteMany({ where: { id, institutionId } });
  found(count || null, "Club");
  return json({ ok: true });
});

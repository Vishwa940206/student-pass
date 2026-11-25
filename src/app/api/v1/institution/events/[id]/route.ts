import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { CAMPUS, found, requireStaff } from "@/lib/campus/access";

export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/events/[id]">) => {
  const { institutionId } = await requireStaff(...CAMPUS);
  const { id } = await ctx.params;
  const { count } = await db.event.deleteMany({ where: { id, institutionId } });
  found(count || null, "Event");
  return json({ ok: true });
});

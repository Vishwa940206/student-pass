import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/admin/proposals/[id]">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  const { status } = await body(req, z.object({ status: z.enum(["NEW", "CONTACTED", "WON", "LOST"]) }));
  const { count } = await db.proposalRequest.updateMany({ where: { id }, data: { status } });
  found(count || null, "Request");
  return json({ ok: true });
});

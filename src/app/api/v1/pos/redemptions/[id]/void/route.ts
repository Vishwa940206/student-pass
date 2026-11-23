import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { voidRedemption } from "@/lib/pos/service";

/** Void a completed redemption (refund or mistake). Gives the allowance back. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/pos/redemptions/[id]/void">) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  const { reason } = await body(req, z.object({ reason: z.string().trim().min(2).max(200) }));
  return json({ redemption: await voidRedemption(staff, id, reason) });
});

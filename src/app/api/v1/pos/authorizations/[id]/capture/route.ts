import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { capture } from "@/lib/pos/service";

/** Complete the sale. Safe to retry. */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/pos/authorizations/[id]/capture">) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  return json({ redemption: await capture(staff, id) });
});

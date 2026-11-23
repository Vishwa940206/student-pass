import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { cancel } from "@/lib/pos/service";

/** Release a hold (basket changed or sale abandoned). Safe to retry. */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/pos/authorizations/[id]/cancel">) => {
  const staff = await requireStaff();
  const { id } = await ctx.params;
  return json({ authorization: await cancel(staff, id) });
});

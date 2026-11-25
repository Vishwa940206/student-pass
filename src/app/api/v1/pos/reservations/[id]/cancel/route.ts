import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found } from "@/lib/campus/access";
import { requireStaff } from "@/lib/pos/staff";
import { release } from "@/lib/shop";

export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/pos/reservations/[id]/cancel">) => {
  const { merchantId } = await requireStaff();
  const { id } = await ctx.params;
  const r = found(await db.reservation.findFirst({ where: { id, product: { merchantId } }, select: { status: true } }), "Reservation");
  if (r.status !== "RESERVED") throw new ApiError(409, "NOT_OPEN", "This reservation is already closed");
  await release(id, "CANCELLED");
  return json({ ok: true });
});

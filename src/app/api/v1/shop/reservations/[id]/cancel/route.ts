import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";
import { release } from "@/lib/shop";

export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/shop/reservations/[id]/cancel">) => {
  const { studentId } = await requireCampusStudent();
  const { id } = await ctx.params;
  const r = found(await db.reservation.findFirst({ where: { id, studentId }, select: { status: true } }), "Reservation");
  if (r.status !== "RESERVED") throw new ApiError(409, "NOT_OPEN", "This reservation is already closed");
  await release(id, "CANCELLED");
  return json({ ok: true });
});

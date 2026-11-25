import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";
import { humanCode } from "@/lib/codes";
import { limit } from "@/lib/rate-limit";
import { expireReservations, HOLD_DAYS, MAX_ACTIVE_RESERVATIONS } from "@/lib/shop";

/** Reserve at the student price: holds stock for 7 days; pay and collect at the merchant. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/shop/products/[id]/reserve">) => {
  const { studentId } = await requireCampusStudent();
  await limit("reserve:student", studentId, 30, 60 * 60);
  const { id } = await ctx.params;
  const { quantity } = await body(req, z.object({ quantity: z.int().min(1).max(5).default(1) }));
  await expireReservations({ studentId });
  const r = await db.$transaction(async (tx) => {
    const active = await tx.reservation.count({ where: { studentId, status: "RESERVED" } });
    if (active >= MAX_ACTIVE_RESERVATIONS) throw new ApiError(409, "TOO_MANY", "You have too many open reservations. Collect or cancel some first");
    const [row] = await tx.$queryRaw<{ id: string; active: boolean; stock: number | null; priceCents: number }[]>`
      SELECT id, active, stock, "priceCents" FROM "Product" WHERE id = ${id} FOR UPDATE`;
    const p = found(row, "Product");
    if (!p.active) throw new ApiError(409, "UNAVAILABLE", "This product isn’t available");
    if (p.stock !== null && p.stock < quantity) throw new ApiError(409, "OUT_OF_STOCK", p.stock ? `Only ${p.stock} left` : "Out of stock");
    if (p.stock !== null) await tx.product.update({ where: { id }, data: { stock: { decrement: quantity } } });
    return tx.reservation.create({
      data: { code: humanCode(), productId: id, studentId, quantity, priceCents: p.priceCents, expiresAt: new Date(Date.now() + HOLD_DAYS * 86_400_000) },
      select: { id: true, code: true, expiresAt: true },
    });
  });
  return json(r, 201);
});

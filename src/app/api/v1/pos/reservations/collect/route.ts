import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { award, RULES } from "@/lib/points";

/** The student paid at the till: mark the reservation collected (by its code). */
export const POST = handler(async (req) => {
  const { merchantId } = await requireStaff();
  const { code } = await body(req, z.object({ code: z.string().trim().toUpperCase().min(4).max(16) }));
  const r = await db.reservation.findFirst({
    where: { code, product: { merchantId } },
    select: { id: true, status: true, expiresAt: true, quantity: true, priceCents: true, studentId: true, product: { select: { title: true } }, student: { select: { user: { select: { name: true } } } } },
  });
  if (!r) throw new ApiError(404, "NOT_FOUND", "No reservation with that code at your shop");
  if (r.status !== "RESERVED") throw new ApiError(409, "NOT_OPEN", `This reservation is ${r.status.toLowerCase()}`);
  if (r.expiresAt < new Date()) throw new ApiError(409, "EXPIRED", "This reservation has expired");
  await db.$transaction(async (tx) => {
    const { count } = await tx.reservation.updateMany({ where: { id: r.id, status: "RESERVED" }, data: { status: "COLLECTED", collectedAt: new Date() } });
    if (!count) throw new ApiError(409, "NOT_OPEN", "This reservation was just closed");
    const total = r.priceCents * r.quantity;
    await award(tx, r.studentId, "SHOP_COLLECTED", r.id, Math.floor(total / 10_000) * RULES.SHOP_PER_100_LKR, `Shop · ${r.product.title}`);
  });
  return json({ ok: true, product: r.product.title, quantity: r.quantity, totalCents: r.priceCents * r.quantity, student: r.student.user.name.split(" ")[0] });
});

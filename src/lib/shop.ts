import "server-only";
import { db } from "@/lib/db";

export const HOLD_DAYS = 7;
export const MAX_ACTIVE_RESERVATIONS = 10;

export const SHOP_CATEGORIES = [
  "Books", "eBooks & audio", "Software & subscriptions", "Laptops & tech", "Accessories", "Stationery & study",
  "Room & living", "Food & drinks", "Health & care", "Fashion & merch", "Travel", "Gift cards",
] as const;

/** Expires overdue holds and puts their stock back. Cheap; called from the shop's read paths. */
export async function expireReservations(where: { studentId?: string; merchantId?: string } = {}) {
  const due = await db.reservation.findMany({
    where: { status: "RESERVED", expiresAt: { lt: new Date() }, ...(where.studentId && { studentId: where.studentId }), ...(where.merchantId && { product: { merchantId: where.merchantId } }) },
    select: { id: true }, take: 200,
  });
  for (const r of due) await release(r.id, "EXPIRED");
}

/** Moves a RESERVED hold to EXPIRED / CANCELLED and restores stock (once). */
export async function release(id: string, status: "EXPIRED" | "CANCELLED") {
  await db.$transaction(async (tx) => {
    const r = await tx.reservation.findUnique({ where: { id }, select: { productId: true, quantity: true } });
    if (!r) return;
    const { count } = await tx.reservation.updateMany({ where: { id, status: "RESERVED" }, data: { status } });
    if (count) await tx.product.updateMany({ where: { id: r.productId, stock: { not: null } }, data: { stock: { increment: r.quantity } } });
  });
}

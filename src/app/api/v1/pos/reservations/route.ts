import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { expireReservations } from "@/lib/shop";

/** Reservations for this merchant's products (open first). */
export const GET = handler(async () => {
  const { merchantId } = await requireStaff();
  await expireReservations({ merchantId });
  const reservations = await db.reservation.findMany({
    where: { product: { merchantId } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200,
    select: { id: true, code: true, quantity: true, priceCents: true, status: true, expiresAt: true, collectedAt: true, createdAt: true,
      product: { select: { title: true } }, student: { select: { user: { select: { name: true } }, institution: { select: { shortName: true } } } } },
  });
  return json({ reservations: reservations.map((r) => ({ ...r, student: { name: r.student.user.name.split(" ")[0], institution: r.student.institution.shortName } })) });
});

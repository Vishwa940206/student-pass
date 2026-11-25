import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { expireReservations } from "@/lib/shop";

/** The student's reservations, newest first. */
export const GET = handler(async () => {
  const { studentId } = await requireCampusStudent();
  await expireReservations({ studentId });
  const reservations = await db.reservation.findMany({
    where: { studentId }, orderBy: { createdAt: "desc" }, take: 50,
    select: { id: true, code: true, quantity: true, priceCents: true, status: true, expiresAt: true, collectedAt: true, createdAt: true,
      product: { select: { title: true, art: true, category: true, merchant: { select: { name: true, locations: { where: { inProgramme: true }, select: { name: true } } } } } } },
  });
  return json({ reservations });
});

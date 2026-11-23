import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";

/** Recent redemptions for this merchant (reconciliation ledger). No student details. */
export const GET = handler(async () => {
  const staff = await requireStaff();
  const redemptions = await db.redemption.findMany({
    where: { authorization: { location: { merchantId: staff.merchantId } } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true, ref: true, discountCents: true, voidedAt: true, voidReason: true, createdAt: true,
      offer: { select: { title: true, sponsor: { select: { shortName: true } } } },
      authorization: { select: { subtotalCents: true, location: { select: { code: true } } } },
    },
  });
  return json({ redemptions });
});

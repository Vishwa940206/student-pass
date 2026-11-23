import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";

export const GET = handler(async () => {
  const staff = await requireStaff();
  const merchant = await db.merchant.findUniqueOrThrow({
    where: { id: staff.merchantId },
    select: {
      name: true,
      locations: { select: { id: true, code: true, name: true, district: true, inProgramme: true }, orderBy: { code: "asc" } },
    },
  });
  return json(merchant);
});

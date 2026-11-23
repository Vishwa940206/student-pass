import "server-only";
import { db } from "@/lib/db";
import { requireUser, AuthError } from "@/lib/auth/session";
import type { Staff } from "@/lib/pos/service";

export async function requireStaff(): Promise<Staff> {
  const user = await requireUser("MERCHANT_STAFF");
  const staff = await db.merchantStaff.findUnique({ where: { userId: user.id } });
  if (!staff) throw new AuthError(403);
  return { userId: user.id, merchantId: staff.merchantId };
}

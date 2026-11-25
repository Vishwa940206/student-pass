import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";

/** Creates a merchant staff login (one-time password). Refuses an email that already has an account. */
export async function createMerchantStaff(merchantId: string, name: string, email: string) {
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) throw new ApiError(409, "EMAIL_TAKEN", "An account with that email already exists");
  const tempPassword = generateTempPassword();
  await db.user.create({ data: { email, name, passwordHash: await hashPassword(tempPassword), role: "MERCHANT_STAFF", staff: { create: { merchantId } } } });
  return { email, tempPassword };
}

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "item";

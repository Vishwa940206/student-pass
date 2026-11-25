import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

/**
 * Who may post: platform admins (anywhere), institution admins (optionally only for their
 * students) and merchant staff (jobs). Returns the institution scope a poster may use.
 */
export async function requirePoster() {
  const user = await requireUser("ADMIN", "INSTITUTION_STAFF", "MERCHANT_STAFF");
  let institutionId: string | null = null;
  if (user.role === "INSTITUTION_STAFF") {
    const s = await db.institutionStaff.findUnique({ where: { userId: user.id }, select: { institutionId: true, staffRole: true } });
    if (!s || s.staffRole !== "ADMIN") throw new ApiError(403, "ADMINS_ONLY", "Only institution admins can post listings");
    institutionId = s.institutionId;
  }
  return { user, institutionId };
}

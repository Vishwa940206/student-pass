import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * Creates an institution staff account with a one-time password. Refuses an email that
 * already has an account, so a student or merchant login can never be turned into staff.
 */
export async function createStaffAccount(input: {
  institutionId: string;
  email: string;
  name: string;
  staffRole: StaffRole;
}): Promise<{ userId: string; email: string; tempPassword: string }> {
  const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw new ApiError(409, "EMAIL_TAKEN", "An account with that email already exists");

  const tempPassword = generateTempPassword();
  const user = await db.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash: await hashPassword(tempPassword),
      role: "INSTITUTION_STAFF",
      institutionStaff: { create: { institutionId: input.institutionId, staffRole: input.staffRole } },
    },
  });
  return { userId: user.id, email: user.email, tempPassword };
}

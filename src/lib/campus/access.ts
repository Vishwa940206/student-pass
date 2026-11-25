import "server-only";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { requireUser, type CurrentUser } from "@/lib/auth/session";
import type { StaffRole } from "@/generated/prisma/client";

/**
 * Tenant isolation for Campus Life and Institution OS.
 *
 * Every campus row belongs to one institution. Handlers get the caller's institutionId
 * from these helpers — never from the request — and must include it in every query
 * (`where: { id, institutionId }`), so ids from another institution simply don't match.
 */

export interface CampusStudent {
  user: CurrentUser;
  studentId: string;
  institutionId: string;
}

/** A verified student whose pass hasn't expired. Pending / rejected students get a clear 403. */
export async function requireCampusStudent(): Promise<CampusStudent> {
  const user = await requireUser("STUDENT");
  const p = await db.studentProfile.findUnique({
    where: { userId: user.id },
    select: { id: true, institutionId: true, verificationStatus: true, validUntil: true },
  });
  if (!p) throw new ApiError(403, "NO_PROFILE", "No student profile on this account");
  if (p.verificationStatus !== "VERIFIED") {
    throw new ApiError(403, "NOT_VERIFIED", "Campus Life opens once your institution verifies you");
  }
  if (p.validUntil && p.validUntil < new Date()) {
    throw new ApiError(403, "EXPIRED", "Your pass has expired. Ask your institution to renew it");
  }
  return { user, studentId: p.id, institutionId: p.institutionId };
}

export interface Staff {
  user: CurrentUser;
  institutionId: string;
  staffRole: StaffRole;
}

/**
 * Institution staff. Pass the staff roles allowed to make the call; none = any staff.
 *   requireStaff()                        any staff member
 *   requireStaff("ADMIN")                 institution admins only
 *   requireStaff(...CAMPUS)               admins + lecturers (campus content, courses)
 *   requireStaff(...ADMISSIONS)           admins + counsellors (CRM, admissions)
 * A user whose staff row was removed is treated as signed out of the portal.
 */
export async function requireStaff(...allowed: StaffRole[]): Promise<Staff> {
  const user = await requireUser("INSTITUTION_STAFF");
  const s = await db.institutionStaff.findUnique({ where: { userId: user.id } });
  if (!s) throw new ApiError(403, "NO_INSTITUTION", "This account isn’t linked to an institution");
  if (allowed.length && !allowed.includes(s.staffRole)) {
    throw new ApiError(403, "ROLE", "Your role doesn’t include this section");
  }
  return { user, institutionId: s.institutionId, staffRole: s.staffRole };
}

export const CAMPUS: StaffRole[] = ["ADMIN", "LECTURER"];
export const ADMISSIONS: StaffRole[] = ["ADMIN", "COUNSELLOR"];

/** Throws 404 unless the row exists in this institution (hides other tenants' ids). */
export function found<T>(row: T | null | undefined, what: string): T {
  if (!row) throw new ApiError(404, "NOT_FOUND", `${what} not found`);
  return row;
}

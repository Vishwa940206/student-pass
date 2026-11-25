import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { award, RULES } from "@/lib/points";

export const Decision = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("VERIFIED"), validUntil: z.iso.date() }),
  z.object({ decision: z.literal("REJECTED") }),
]);

/**
 * Approve or reject a pending student. `institutionId` limits it to one institution
 * (institution admins); platform admins pass undefined.
 */
export async function decideVerification(id: string, d: z.infer<typeof Decision>, institutionId?: string) {
  const { count } = await db.studentProfile.updateMany({
    where: { id, verificationStatus: "PENDING", ...(institutionId && { institutionId }) },
    data:
      d.decision === "VERIFIED"
        // 18:29:59Z = 23:59:59 in Asia/Colombo on that date
        ? { verificationStatus: "VERIFIED", verifiedAt: new Date(), validUntil: new Date(`${d.validUntil}T18:29:59Z`) }
        : { verificationStatus: "REJECTED" },
  });
  if (!count) throw new ApiError(409, "NOT_PENDING", "This student isn’t pending verification");
  if (d.decision === "VERIFIED") await award(db, id, "WELCOME", id, RULES.WELCOME, "Welcome to Student Pass");
}

export const pendingSelect = {
  id: true, studentNumber: true, programme: true, createdAt: true,
  user: { select: { name: true, email: true } },
  institution: { select: { name: true, shortName: true } },
} as const;

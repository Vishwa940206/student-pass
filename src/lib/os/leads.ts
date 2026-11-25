import "server-only";
import { db } from "@/lib/db";
import type { LeadStage, Prisma } from "@/generated/prisma/client";

/** Records an activity on a lead and bumps its lastActivityAt. */
export async function logActivity(
  tx: Prisma.TransactionClient | typeof db,
  leadId: string,
  kind: "NOTE" | "CALL" | "WHATSAPP" | "EMAIL" | "MEETING" | "STAGE" | "SYSTEM",
  body: string,
  authorId: string | null,
) {
  await tx.leadActivity.create({ data: { leadId, kind, body, authorId } });
  await tx.lead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } });
}

/**
 * Counsellor with the fewest open leads at this institution (round-robin by load),
 * or null if the institution has no counsellors. Used for website enquiries.
 */
export async function pickCounsellor(institutionId: string): Promise<string | null> {
  const counsellors = await db.institutionStaff.findMany({ where: { institutionId, staffRole: "COUNSELLOR" }, select: { userId: true } });
  if (!counsellors.length) return null;
  const loads = await db.lead.groupBy({
    by: ["counsellorId"],
    where: { institutionId, lostAt: null, stage: { notIn: ["ENROLLED"] }, counsellorId: { in: counsellors.map((c) => c.userId) } },
    _count: true,
  });
  const load = (id: string) => loads.find((l) => l.counsellorId === id)?._count ?? 0;
  return counsellors.map((c) => c.userId).sort((a, b) => load(a) - load(b))[0];
}

/** Lead stage that an application status implies (null = leave the stage alone). */
export function stageForStatus(status: string): LeadStage | null {
  switch (status) {
    case "UNDER_REVIEW": return "APPLIED";
    case "OFFER_ISSUED": case "ACCEPTED": case "DEPOSIT_PAID": return "OFFER";
    case "ENROLLED": return "ENROLLED";
    default: return null;
  }
}

export const leadListSelect = {
  id: true, name: true, phone: true, email: true, district: true, source: true, stage: true, consent: true,
  lostAt: true, lostReason: true, lastActivityAt: true, createdAt: true,
  programme: { select: { id: true, name: true } },
  counsellor: { select: { id: true, name: true } },
  application: { select: { id: true, status: true, intake: true } },
} as const;

import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { ADMISSIONS, requireStaff } from "@/lib/campus/access";
import type { Prisma } from "@/generated/prisma/client";

const STATUSES = ["UNDER_REVIEW", "OFFER_ISSUED", "ACCEPTED", "DEPOSIT_PAID", "ENROLLED", "REJECTED", "WITHDRAWN"] as const;

/** Admissions board. Filters: status, programme, intake. */
export const GET = handler(async (req) => {
  const { institutionId } = await requireStaff(...ADMISSIONS);
  const p = new URL(req.url).searchParams;
  const where: Prisma.ApplicationWhereInput = { institutionId };
  const s = p.get("status");
  if (s && (STATUSES as readonly string[]).includes(s)) where.status = s as (typeof STATUSES)[number];
  if (p.get("programme")) where.programmeId = p.get("programme")!;
  if (p.get("intake")) where.intake = p.get("intake")!;
  const applications = await db.application.findMany({
    where, orderBy: { statusAt: "asc" }, take: 1000,
    select: {
      id: true, status: true, intake: true, statusAt: true, createdAt: true,
      programme: { select: { id: true, name: true } },
      lead: { select: { id: true, name: true, phone: true, email: true, counsellor: { select: { name: true } } } },
    },
  });
  return json({ applications });
});

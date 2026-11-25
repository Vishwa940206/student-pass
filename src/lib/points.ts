import "server-only";
import { db } from "@/lib/db";
import type { PointsReason, Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient | typeof db;

/** Earning rules (Pass Points). */
export const RULES = {
  WELCOME: 100, // first verification
  OFFER_REDEEMED: 50, // per redemption at the till
  FEE_PER_1000_LKR: 1, // per LKR 1,000 of an invoice paid
  FEE_MAX: 500, // per invoice
  SHOP_PER_100_LKR: 1, // per LKR 100 of a collected reservation
} as const;

/** Tiers from the design: Mint → Green → Black. */
export const TIERS = [["Mint", 0], ["Green", 1500], ["Black", 4000]] as const;
export const tierOf = (lifetime: number) => {
  let i = 0;
  TIERS.forEach(([, min], k) => { if (lifetime >= min) i = k; });
  const next = TIERS[i + 1];
  return { name: TIERS[i][0], next: next ? { name: next[0], at: next[1] } : null };
};

/**
 * Adds a ledger entry once per (reason, refId). Safe to call again for the same event
 * (retries, replayed notifications): the second call does nothing. Returns true if added.
 */
export async function award(tx: Tx, studentId: string, reason: PointsReason, refId: string, delta: number, note: string): Promise<boolean> {
  if (!delta) return false;
  const { count } = await tx.pointsEntry.createMany({ data: [{ studentId, reason, refId, delta, note }], skipDuplicates: true });
  return count > 0;
}

export async function balance(studentId: string, tx: Tx = db) {
  const [sum, earned] = await Promise.all([
    tx.pointsEntry.aggregate({ where: { studentId }, _sum: { delta: true } }),
    tx.pointsEntry.aggregate({ where: { studentId, delta: { gt: 0 }, reason: { notIn: ["REWARD_REFUND"] } }, _sum: { delta: true } }),
  ]);
  return { balance: sum._sum.delta ?? 0, lifetime: earned._sum.delta ?? 0 };
}

/** Points for a paid invoice (credited once per invoice). */
export async function awardFeePaid(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUnique({ where: { id: invoiceId }, select: { studentId: true, amountCents: true, number: true } });
  if (!inv) return;
  const pts = Math.min(RULES.FEE_MAX, Math.floor(inv.amountCents / 100_000) * RULES.FEE_PER_1000_LKR);
  await award(tx, inv.studentId, "FEE_PAID", invoiceId, pts, `Paid ${inv.number}`);
}

/** Reverses an earlier credit (e.g. a voided redemption or a chargeback), only if it was given. */
export async function reverse(tx: Tx, original: { reason: PointsReason; refId: string }, reason: PointsReason, refId: string, note: string) {
  const e = await tx.pointsEntry.findUnique({ where: { reason_refId: original }, select: { studentId: true, delta: true } });
  if (e) await award(tx, e.studentId, reason, refId, -e.delta, note);
}

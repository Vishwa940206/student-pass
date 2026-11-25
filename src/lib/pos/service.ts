import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { award, reverse, RULES } from "@/lib/points";
import { verifyToken } from "@/lib/pass-token";
import { startOfColomboWeek, startOfColomboYear } from "@/lib/time";
import { evaluate, type OfferFacts, type RuleCode } from "@/lib/pos/rules";
import { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export const HOLD_MINUTES = 5;

export type PosErrorCode =
  | RuleCode
  | "TOKEN_MALFORMED"
  | "TOKEN_BAD_SIGNATURE"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "UNKNOWN_PASS"
  | "UNKNOWN_OFFER"
  | "UNKNOWN_LOCATION"
  | "WRONG_MERCHANT"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "HOLD_EXPIRED";

export class PosError extends Error {
  constructor(
    public code: PosErrorCode,
    message: string,
    public status = 422,
  ) {
    super(message);
  }
}

export interface Staff {
  userId: string;
  merchantId: string;
}

// ───────────── helpers ─────────────

function checkToken(token: string) {
  const t = verifyToken(token);
  if (!t.ok) {
    const msg = {
      MALFORMED: "That isn’t a Student Pass QR code",
      BAD_SIGNATURE: "QR code failed verification — it may be forged",
      EXPIRED: "QR code expired — ask the student to show the live code",
    }[t.reason];
    throw new PosError(`TOKEN_${t.reason}`, msg);
  }
  return t;
}

/** Row-lock the student so concurrent scans (e.g. two branches) are serialised. */
async function lockStudentByPassId(tx: Tx, passId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "StudentProfile" WHERE "passId" = ${passId} FOR UPDATE`;
  if (!rows.length) throw new PosError("UNKNOWN_PASS", "Pass not recognised", 404);
  return tx.studentProfile.findUniqueOrThrow({
    where: { id: rows[0].id },
    include: { user: { select: { name: true } }, institution: { select: { id: true, shortName: true } } },
  });
}

async function restoreSponsorBudget(tx: Tx, offerId: string, cents: number) {
  await tx.offer.updateMany({
    where: { id: offerId, discountType: "SPONSORED", sponsorBudgetCents: { not: null } },
    data: { sponsorBudgetCents: { increment: cents } },
  });
}

/** Expire this student's stale holds (and give back reserved sponsor budget). */
async function expireStaleHolds(tx: Tx, studentId: string, now: Date) {
  const stale = await tx.authorization.findMany({
    where: { studentId, status: "HELD", expiresAt: { lte: now } },
  });
  for (const a of stale) {
    await tx.authorization.update({ where: { id: a.id }, data: { status: "EXPIRED" } });
    await restoreSponsorBudget(tx, a.offerId, a.discountCents);
  }
}

async function usageFor(tx: Tx, studentId: string, offerId: string, now: Date) {
  const count = (since: Date) =>
    Promise.all([
      tx.redemption.count({ where: { studentId, offerId, voidedAt: null, createdAt: { gte: since } } }),
      tx.authorization.count({ where: { studentId, offerId, status: "HELD", createdAt: { gte: since } } }),
    ]).then(([r, h]) => r + h);
  const [thisWeek, thisYear] = await Promise.all([
    count(startOfColomboWeek(now)),
    count(startOfColomboYear(now)),
  ]);
  return { thisWeek, thisYear };
}

const offerInclude = { locations: { select: { locationId: true } } } as const;
type OfferRow = Prisma.OfferGetPayload<{ include: typeof offerInclude }>;

const toOfferFacts = (o: OfferRow): OfferFacts => ({
  status: o.status,
  startsAt: o.startsAt,
  endsAt: o.endsAt,
  discountType: o.discountType,
  discountValue: o.discountValue,
  maxDiscountCents: o.maxDiscountCents,
  minSpendCents: o.minSpendCents,
  sponsorId: o.sponsorId,
  sponsorBudgetCents: o.sponsorBudgetCents,
  limitPerWeek: o.limitPerWeek,
  limitPerYear: o.limitPerYear,
  locationIds: o.locations.map((l) => l.locationId),
});

async function loadLocation(tx: Tx, staff: Staff, locationId: string) {
  const location = await tx.merchantLocation.findUnique({ where: { id: locationId } });
  if (!location) throw new PosError("UNKNOWN_LOCATION", "Unknown branch", 404);
  if (location.merchantId !== staff.merchantId) throw new PosError("WRONG_MERCHANT", "Not your branch", 403);
  return location;
}

const displayName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0]}.` : first;
};

// ───────────── scan (dry run) ─────────────

/**
 * What the cashier sees after scanning: a minimal identity (first name + initial,
 * institution short name) and which of this merchant's offers apply to the basket.
 * Nothing is reserved.
 */
export async function scan(staff: Staff, input: { token: string; locationId: string; subtotalCents: number }) {
  const t = checkToken(input.token);
  const now = new Date();
  return db.$transaction(async (tx) => {
    const student = await lockStudentByPassId(tx, t.passId);
    const location = await loadLocation(tx, staff, input.locationId);
    await expireStaleHolds(tx, student.id, now);
    const offers = await tx.offer.findMany({
      where: { merchantId: staff.merchantId, status: "LIVE" },
      include: offerInclude,
      orderBy: { createdAt: "asc" },
    });
    const evaluated = await Promise.all(
      offers.map(async (o) => {
        const r = evaluate({
          student,
          offer: toOfferFacts(o),
          location,
          usage: await usageFor(tx, student.id, o.id, now),
          subtotalCents: input.subtotalCents,
          now,
        });
        return { offerId: o.id, title: o.title, ...r };
      }),
    );
    return {
      student: {
        name: displayName(student.user.name),
        institution: student.institution.shortName,
        verified: student.verificationStatus === "VERIFIED",
        frozen: student.passState === "FROZEN",
      },
      offers: evaluated,
    };
  });
}

// ───────────── authorise → capture ─────────────

export async function authorize(
  staff: Staff,
  input: { token: string; offerId: string; locationId: string; subtotalCents: number; idempotencyKey: string },
) {
  // Retries with the same key return the original authorisation.
  const existing = await db.authorization.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.authorizedById !== staff.userId) throw new PosError("INVALID_STATE", "Idempotency key reused", 409);
    return existing;
  }

  const t = checkToken(input.token);
  const now = new Date();
  try {
    return await db.$transaction(async (tx) => {
      const student = await lockStudentByPassId(tx, t.passId);
      const location = await loadLocation(tx, staff, input.locationId);
      const offer = await tx.offer.findUnique({ where: { id: input.offerId }, include: offerInclude });
      if (!offer) throw new PosError("UNKNOWN_OFFER", "Unknown offer", 404);
      if (offer.merchantId !== staff.merchantId) throw new PosError("WRONG_MERCHANT", "Not your offer", 403);

      if (await tx.authorization.findUnique({ where: { studentId_tokenStep: { studentId: student.id, tokenStep: t.step } } })) {
        throw new PosError("TOKEN_ALREADY_USED", "This QR code was already used — ask for the next one", 409);
      }

      await expireStaleHolds(tx, student.id, now);
      const result = evaluate({
        student,
        offer: toOfferFacts(offer),
        location,
        usage: await usageFor(tx, student.id, offer.id, now),
        subtotalCents: input.subtotalCents,
        now,
      });
      if (!result.ok) throw new PosError(result.code, result.message);

      // Reserve sponsor budget atomically (guards against overspend across branches).
      if (offer.discountType === "SPONSORED" && offer.sponsorBudgetCents != null) {
        const { count } = await tx.offer.updateMany({
          where: { id: offer.id, sponsorBudgetCents: { gte: result.discountCents } },
          data: { sponsorBudgetCents: { decrement: result.discountCents } },
        });
        if (!count) throw new PosError("SPONSOR_BUDGET_EXHAUSTED", "The sponsor’s budget for this offer is used up");
      }

      return tx.authorization.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          studentId: student.id,
          offerId: offer.id,
          locationId: location.id,
          authorizedById: staff.userId,
          tokenStep: t.step,
          subtotalCents: input.subtotalCents,
          discountCents: result.discountCents,
          expiresAt: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        },
      });
    });
  } catch (e) {
    // Lost a race on the idempotency key → return the winner.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const won = await db.authorization.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (won) return won;
      throw new PosError("TOKEN_ALREADY_USED", "This QR code was already used — ask for the next one", 409);
    }
    throw e;
  }
}

async function lockAuthorization(tx: Tx, staff: Staff, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Authorization" WHERE id = ${id} FOR UPDATE`;
  if (!rows.length) throw new PosError("NOT_FOUND", "Authorisation not found", 404);
  const a = await tx.authorization.findUniqueOrThrow({
    where: { id },
    include: { location: { select: { merchantId: true } }, redemption: true },
  });
  if (a.location.merchantId !== staff.merchantId) throw new PosError("WRONG_MERCHANT", "Not your authorisation", 403);
  return a;
}

const newRef = () => "RCP-" + randomBytes(4).toString("hex").toUpperCase();

/** Completes the sale. Idempotent: capturing twice returns the same redemption. */
export async function capture(staff: Staff, authorizationId: string) {
  return db.$transaction(async (tx) => {
    const a = await lockAuthorization(tx, staff, authorizationId);
    if (a.status === "CAPTURED" && a.redemption) return a.redemption;
    if (a.status !== "HELD") throw new PosError("INVALID_STATE", `Authorisation is ${a.status.toLowerCase()}`, 409);
    if (a.expiresAt <= new Date()) {
      await tx.authorization.update({ where: { id: a.id }, data: { status: "EXPIRED" } });
      await restoreSponsorBudget(tx, a.offerId, a.discountCents);
      throw new PosError("HOLD_EXPIRED", "Hold expired — scan again", 409);
    }
    await tx.authorization.update({ where: { id: a.id }, data: { status: "CAPTURED" } });
    const redemption = await tx.redemption.create({
      data: {
        ref: newRef(),
        authorizationId: a.id,
        studentId: a.studentId,
        offerId: a.offerId,
        discountCents: a.discountCents,
      },
    });
    await award(tx, a.studentId, "OFFER_REDEEMED", redemption.id, RULES.OFFER_REDEEMED, `Offer redeemed · ${redemption.ref}`);
    return redemption;
  });
}

/** Releases a hold (basket changed / sale abandoned). Idempotent. */
export async function cancel(staff: Staff, authorizationId: string) {
  return db.$transaction(async (tx) => {
    const a = await lockAuthorization(tx, staff, authorizationId);
    if (a.status === "CANCELLED" || a.status === "EXPIRED") return a;
    if (a.status !== "HELD") throw new PosError("INVALID_STATE", "Captured sales must be voided instead", 409);
    await restoreSponsorBudget(tx, a.offerId, a.discountCents);
    return tx.authorization.update({ where: { id: a.id }, data: { status: "CANCELLED" } });
  });
}

/** Voids a completed redemption (refund / mistake); gives the allowance back. Idempotent. */
export async function voidRedemption(staff: Staff, redemptionId: string, reason: string) {
  return db.$transaction(async (tx) => {
    const r = await tx.redemption.findUnique({
      where: { id: redemptionId },
      include: { authorization: { include: { location: { select: { merchantId: true } } } } },
    });
    if (!r) throw new PosError("NOT_FOUND", "Redemption not found", 404);
    if (r.authorization.location.merchantId !== staff.merchantId) {
      throw new PosError("WRONG_MERCHANT", "Not your redemption", 403);
    }
    if (r.voidedAt) return r;
    const { count } = await tx.redemption.updateMany({
      where: { id: r.id, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: reason },
    });
    if (count) {
      await restoreSponsorBudget(tx, r.offerId, r.discountCents);
      await reverse(tx, { reason: "OFFER_REDEEMED", refId: r.id }, "OFFER_VOIDED", r.id, `Refund · ${r.ref}`);
    }
    return tx.redemption.findUniqueOrThrow({ where: { id: r.id } });
  });
}

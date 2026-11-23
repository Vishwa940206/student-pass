/**
 * Pure eligibility + discount rules for a POS scan. No database access here,
 * so every rule is unit-testable. The service layer loads the facts and
 * persists the result inside a transaction.
 */
export type RuleCode =
  | "PASS_FROZEN"
  | "NOT_VERIFIED"
  | "PASS_EXPIRED"
  | "OFFER_NOT_LIVE"
  | "OFFER_NOT_STARTED"
  | "OFFER_ENDED"
  | "BRANCH_UNAVAILABLE"
  | "INSTITUTION_ONLY"
  | "BELOW_MIN_SPEND"
  | "WEEKLY_LIMIT_REACHED"
  | "YEARLY_LIMIT_REACHED"
  | "SPONSOR_BUDGET_EXHAUSTED"
  | "NO_DISCOUNT";

export const RULE_MESSAGES: Record<RuleCode, string> = {
  PASS_FROZEN: "Pass frozen by the student — ask them to unfreeze it in the app",
  NOT_VERIFIED: "Student status isn’t verified yet",
  PASS_EXPIRED: "Student verification has expired",
  OFFER_NOT_LIVE: "This offer isn’t live yet",
  OFFER_NOT_STARTED: "This offer hasn’t started yet",
  OFFER_ENDED: "This offer has ended",
  BRANCH_UNAVAILABLE: "This branch isn’t in the programme",
  INSTITUTION_ONLY: "This offer is only for students of the sponsoring institution",
  BELOW_MIN_SPEND: "Basket is below the minimum spend for this offer",
  WEEKLY_LIMIT_REACHED: "Weekly allowance already used — resets Monday 00:00",
  YEARLY_LIMIT_REACHED: "Yearly allowance already used",
  SPONSOR_BUDGET_EXHAUSTED: "The sponsor’s budget for this offer is used up",
  NO_DISCOUNT: "Nothing to discount on this basket",
};

export interface StudentFacts {
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";
  validUntil: Date | null;
  passState: "ACTIVE" | "FROZEN";
  institutionId: string;
}

export interface OfferFacts {
  status: "DRAFT" | "PROSPECT" | "LIVE" | "PAUSED" | "ENDED";
  startsAt: Date | null;
  endsAt: Date | null;
  discountType: "PERCENT" | "FIXED" | "SPONSORED" | null;
  discountValue: number | null;
  maxDiscountCents: number | null;
  minSpendCents: number | null;
  sponsorId: string | null;
  sponsorBudgetCents: number | null;
  limitPerWeek: number | null;
  limitPerYear: number | null;
  /** Location ids the offer is restricted to; empty = every merchant location. */
  locationIds: string[];
}

export interface LocationFacts {
  id: string;
  inProgramme: boolean;
}

/** Redemptions + live holds counted against the student's allowance. */
export interface UsageFacts {
  thisWeek: number;
  thisYear: number;
}

export type RuleResult =
  | { ok: true; discountCents: number }
  | { ok: false; code: RuleCode; message: string };

const fail = (code: RuleCode): RuleResult => ({ ok: false, code, message: RULE_MESSAGES[code] });

export function computeDiscount(offer: OfferFacts, subtotalCents: number): number {
  const v = offer.discountValue ?? 0;
  let d = 0;
  switch (offer.discountType) {
    case "PERCENT":
      d = Math.round((subtotalCents * v) / 10_000);
      break;
    case "FIXED":
    case "SPONSORED":
      d = v;
      break;
    default:
      d = 0;
  }
  if (offer.maxDiscountCents != null) d = Math.min(d, offer.maxDiscountCents);
  if (offer.discountType === "SPONSORED" && offer.sponsorBudgetCents != null) {
    d = Math.min(d, offer.sponsorBudgetCents);
  }
  return Math.max(0, Math.min(d, subtotalCents));
}

export function evaluate(input: {
  student: StudentFacts;
  offer: OfferFacts;
  location: LocationFacts;
  usage: UsageFacts;
  subtotalCents: number;
  now?: Date;
}): RuleResult {
  const { student, offer, location, usage, subtotalCents } = input;
  const now = input.now ?? new Date();

  if (student.passState === "FROZEN") return fail("PASS_FROZEN");
  if (student.verificationStatus === "EXPIRED") return fail("PASS_EXPIRED");
  if (student.verificationStatus !== "VERIFIED") return fail("NOT_VERIFIED");
  if (student.validUntil && student.validUntil <= now) return fail("PASS_EXPIRED");

  if (offer.status !== "LIVE") return fail(offer.status === "ENDED" ? "OFFER_ENDED" : "OFFER_NOT_LIVE");
  if (offer.startsAt && offer.startsAt > now) return fail("OFFER_NOT_STARTED");
  if (offer.endsAt && offer.endsAt <= now) return fail("OFFER_ENDED");

  if (!location.inProgramme) return fail("BRANCH_UNAVAILABLE");
  if (offer.locationIds.length && !offer.locationIds.includes(location.id)) return fail("BRANCH_UNAVAILABLE");

  if (offer.sponsorId && offer.sponsorId !== student.institutionId) return fail("INSTITUTION_ONLY");
  if (offer.minSpendCents != null && subtotalCents < offer.minSpendCents) return fail("BELOW_MIN_SPEND");
  if (offer.limitPerWeek != null && usage.thisWeek >= offer.limitPerWeek) return fail("WEEKLY_LIMIT_REACHED");
  if (offer.limitPerYear != null && usage.thisYear >= offer.limitPerYear) return fail("YEARLY_LIMIT_REACHED");
  if (offer.discountType === "SPONSORED" && offer.sponsorBudgetCents != null && offer.sponsorBudgetCents <= 0) {
    return fail("SPONSOR_BUDGET_EXHAUSTED");
  }

  const discountCents = computeDiscount(offer, subtotalCents);
  if (discountCents <= 0) return fail("NO_DISCOUNT");
  return { ok: true, discountCents };
}

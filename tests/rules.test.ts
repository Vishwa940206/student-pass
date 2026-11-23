import { describe, expect, it } from "vitest";
import { computeDiscount, evaluate, type OfferFacts, type StudentFacts } from "@/lib/pos/rules";

const now = new Date("2026-11-23T10:00:00Z");
const student: StudentFacts = { verificationStatus: "VERIFIED", validUntil: new Date("2027-06-30"), passState: "ACTIVE", institutionId: "ic" };
const pct: OfferFacts = {
  status: "LIVE", startsAt: null, endsAt: null, discountType: "PERCENT", discountValue: 1000,
  maxDiscountCents: null, minSpendCents: null, sponsorId: null, sponsorBudgetCents: null,
  limitPerWeek: null, limitPerYear: null, locationIds: [],
};
const sponsored: OfferFacts = { ...pct, discountType: "SPONSORED", discountValue: 95_000, sponsorId: "ic", sponsorBudgetCents: 190_000, limitPerWeek: 1, limitPerYear: 48 };
const loc = { id: "kol", inProgramme: true };
const zero = { thisWeek: 0, thisYear: 0 };
const run = (o: Partial<Parameters<typeof evaluate>[0]> = {}) =>
  evaluate({ student, offer: pct, location: loc, usage: zero, subtotalCents: 160_000, now, ...o });

describe("computeDiscount", () => {
  it("percent in basis points, rounded", () => expect(computeDiscount(pct, 95_050)).toBe(9_505));
  it("respects the cap", () => expect(computeDiscount({ ...pct, maxDiscountCents: 5_000 }, 160_000)).toBe(5_000));
  it("never exceeds the basket", () => expect(computeDiscount({ ...pct, discountType: "FIXED", discountValue: 99_999 }, 500)).toBe(500));
  it("sponsored limited by remaining budget", () => expect(computeDiscount({ ...sponsored, sponsorBudgetCents: 40_000 }, 160_000)).toBe(40_000));
});

describe("evaluate", () => {
  it("applies a live percent offer", () => expect(run()).toEqual({ ok: true, discountCents: 16_000 }));

  it.each([
    [{ student: { ...student, passState: "FROZEN" as const } }, "PASS_FROZEN"],
    [{ student: { ...student, verificationStatus: "PENDING" as const } }, "NOT_VERIFIED"],
    [{ student: { ...student, validUntil: new Date("2026-01-01") } }, "PASS_EXPIRED"],
    [{ offer: { ...pct, status: "PROSPECT" as const } }, "OFFER_NOT_LIVE"],
    [{ offer: { ...pct, endsAt: new Date("2026-11-01") } }, "OFFER_ENDED"],
    [{ offer: { ...pct, startsAt: new Date("2026-12-01") } }, "OFFER_NOT_STARTED"],
    [{ location: { id: "gal", inProgramme: false } }, "BRANCH_UNAVAILABLE"],
    [{ offer: { ...pct, locationIds: ["nug"] } }, "BRANCH_UNAVAILABLE"],
    [{ offer: { ...pct, minSpendCents: 200_000 } }, "BELOW_MIN_SPEND"],
    [{ offer: sponsored, student: { ...student, institutionId: "uom" } }, "INSTITUTION_ONLY"],
    [{ offer: sponsored, usage: { thisWeek: 1, thisYear: 1 } }, "WEEKLY_LIMIT_REACHED"],
    [{ offer: sponsored, usage: { thisWeek: 0, thisYear: 48 } }, "YEARLY_LIMIT_REACHED"],
    [{ offer: { ...sponsored, sponsorBudgetCents: 0 } }, "SPONSOR_BUDGET_EXHAUSTED"],
  ])("rejects %o with %s", (o, code) => expect(run(o)).toMatchObject({ ok: false, code }));

  it("frozen beats every other reason", () =>
    expect(run({ student: { ...student, passState: "FROZEN", verificationStatus: "PENDING" }, offer: { ...pct, status: "ENDED" } }))
      .toMatchObject({ code: "PASS_FROZEN" }));

  it("sponsored coffee: weekly allowance", () => expect(run({ offer: sponsored })).toEqual({ ok: true, discountCents: 95_000 }));
});

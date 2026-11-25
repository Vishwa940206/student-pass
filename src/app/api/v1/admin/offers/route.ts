import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { slugify } from "@/lib/merchants";

const CATS = ["Food & drink", "Cinema & events", "Fitness", "AI & productivity", "Design & media", "Study & work", "Music & streaming", "Essentials"] as const;

/** Every offer, any status (platform admin). */
export const GET = handler(async () => {
  await requireUser("ADMIN");
  const offers = await db.offer.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { merchant: { select: { id: true, name: true } }, sponsor: { select: { id: true, shortName: true } }, _count: { select: { redemptions: true } } },
  });
  return json({ offers: offers.map(({ _count, ...o }) => ({ ...o, redemptions: _count.redemptions })), categories: CATS });
});

export const OfferInput = z.object({
  title: z.string().trim().min(3).max(120),
  merchantId: z.string().nullish(),
  category: z.enum(CATS),
  badge: z.string().trim().min(1).max(8),
  benefit: z.string().trim().min(5).max(400),
  howTo: z.string().trim().min(5).max(400),
  channel: z.enum(["IN_STORE", "ONLINE"]),
  districts: z.array(z.string().trim().min(2).max(40)).max(25).default([]),
  status: z.enum(["DRAFT", "PROSPECT", "LIVE", "PAUSED", "ENDED"]),
  externalUrl: z.url({ protocol: /^https?$/ }).nullish().or(z.literal("").transform(() => null)),
  discountType: z.enum(["PERCENT", "FIXED", "SPONSORED"]).nullish(),
  discountValue: z.int().min(1).max(100_000_000).nullish(), // PERCENT: basis points; FIXED / SPONSORED: cents
  maxDiscountCents: z.int().min(1).nullish(),
  minSpendCents: z.int().min(1).nullish(),
  sponsorId: z.string().nullish(),
  sponsorBudgetCents: z.int().min(0).nullish(),
  limitPerWeek: z.int().min(1).max(100).nullish(),
  limitPerYear: z.int().min(1).max(1000).nullish(),
});

/** The till only applies LIVE offers with a merchant and a discount; check that up front. */
export function checkOffer(o: z.infer<typeof OfferInput>) {
  if (o.status === "LIVE" && o.channel === "IN_STORE") {
    if (!o.merchantId) throw new ApiError(400, "MERCHANT", "A live in-store offer needs a merchant");
    if (!o.discountType || !o.discountValue) throw new ApiError(400, "DISCOUNT", "A live in-store offer needs a discount");
  }
  if (o.discountType === "PERCENT" && o.discountValue && o.discountValue > 10_000) throw new ApiError(400, "PERCENT", "A percentage can’t be more than 100%");
  if (o.discountType === "SPONSORED" && (!o.sponsorId || o.sponsorBudgetCents == null)) throw new ApiError(400, "SPONSOR", "A sponsored offer needs an institution and a budget");
}

export const POST = handler(async (req) => {
  await requireUser("ADMIN");
  const o = await body(req, OfferInput);
  checkOffer(o);
  const data = { ...o, externalUrl: o.externalUrl ?? null, merchantId: o.merchantId || null, sponsorId: o.discountType === "SPONSORED" ? o.sponsorId : null };
  const created = await db.offer.create({ data: { ...data, slug: `${slugify(o.title)}-${randomBytes(2).toString("hex")}` }, select: { id: true } });
  return json(created, 201);
});

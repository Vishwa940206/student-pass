import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";
import { checkOffer, OfferInput } from "../route";

/** Edit an offer (send the whole offer, as the form does). */
export const PUT = handler(async (req, ctx: RouteContext<"/api/v1/admin/offers/[id]">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  found(await db.offer.findUnique({ where: { id }, select: { id: true } }), "Offer");
  const o = await body(req, OfferInput);
  checkOffer(o);
  await db.offer.update({ where: { id }, data: { ...o, externalUrl: o.externalUrl ?? null, merchantId: o.merchantId || null, sponsorId: o.discountType === "SPONSORED" ? o.sponsorId : null } });
  return json({ ok: true });
});

import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";

type Ctx = RouteContext<"/api/v1/offers/[id]/save">;

export const PUT = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!(await db.offer.findUnique({ where: { id }, select: { id: true } }))) {
    throw new ApiError(404, "NOT_FOUND", "Offer not found");
  }
  await db.savedOffer.upsert({
    where: { userId_offerId: { userId: user.id, offerId: id } },
    update: {},
    create: { userId: user.id, offerId: id },
  });
  return json({ saved: true });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await db.savedOffer.deleteMany({ where: { userId: user.id, offerId: id } });
  return json({ saved: false });
});

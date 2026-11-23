import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { startOfColomboWeek, startOfColomboYear } from "@/lib/time";
import { SKIN_IDS } from "@/lib/skins";


async function profileFor(userId: string) {
  const student = await db.studentProfile.findUnique({
    where: { userId },
    include: { institution: { select: { id: true, name: true, shortName: true } } },
  });
  if (!student) throw new ApiError(404, "NO_PASS", "No student profile");
  return student;
}

/** Everything the My Pass screen needs, except the live token (see /pass/token). */
export const GET = handler(async () => {
  const user = await requireUser("STUDENT");
  const s = await profileFor(user.id);
  const now = new Date();

  // Sponsored perks from the student's own institution, with this week's usage.
  const sponsored = await db.offer.findMany({
    where: { sponsorId: s.institutionId, status: "LIVE" },
    select: { id: true, title: true, limitPerWeek: true, limitPerYear: true, merchant: { select: { name: true } } },
  });
  const perks = await Promise.all(
    sponsored.map(async (o) => {
      const used = (since: Date) =>
        db.redemption.count({ where: { studentId: s.id, offerId: o.id, voidedAt: null, createdAt: { gte: since } } });
      return { ...o, usedThisWeek: await used(startOfColomboWeek(now)), usedThisYear: await used(startOfColomboYear(now)) };
    }),
  );

  const history = await db.redemption.findMany({
    where: { studentId: s.id, voidedAt: null },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true, ref: true, discountCents: true, createdAt: true,
      offer: { select: { title: true } },
      authorization: { select: { location: { select: { name: true, merchant: { select: { name: true } } } } } },
    },
  });
  const total = await db.redemption.aggregate({ where: { studentId: s.id, voidedAt: null }, _sum: { discountCents: true } });

  return json({
    name: user.name,
    institution: s.institution,
    studentNumber: s.studentNumber,
    programme: s.programme,
    verificationStatus: s.verificationStatus,
    validUntil: s.validUntil,
    passState: s.passState,
    cardSkin: s.cardSkin,
    perks,
    savedTotalCents: total._sum.discountCents ?? 0,
    history: history.map((h) => ({
      id: h.id,
      ref: h.ref,
      title: h.offer.title,
      where: `${h.authorization.location.merchant.name} · ${h.authorization.location.name}`,
      discountCents: h.discountCents,
      createdAt: h.createdAt,
    })),
  });
});

/** Change the card colour. */
export const PATCH = handler(async (req) => {
  const user = await requireUser("STUDENT");
  const { cardSkin } = await body(req, z.object({ cardSkin: z.enum(SKIN_IDS) }));
  await profileFor(user.id);
  await db.studentProfile.update({ where: { userId: user.id }, data: { cardSkin } });
  return json({ cardSkin });
});

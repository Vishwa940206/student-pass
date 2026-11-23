import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export const CATEGORIES = [
  { id: "Food & drink", color: "var(--coral)" },
  { id: "Cinema & events", color: "var(--pink)" },
  { id: "Fitness", color: "var(--mint)" },
  { id: "AI & productivity", color: "var(--cyan)" },
  { id: "Design & media", color: "var(--lilac)" },
  { id: "Study & work", color: "var(--cyan)" },
  { id: "Music & streaming", color: "var(--pink)" },
  { id: "Essentials", color: "var(--sun)" },
] as const;

export const DISTRICTS = ["Colombo", "Gampaha", "Kandy", "Galle", "Jaffna", "Kurunegala"] as const;

export const OfferQuery = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().max(40).optional(),
  channel: z.enum(["IN_STORE", "ONLINE"]).optional(),
  district: z.string().max(40).optional(),
  saved: z.enum(["1", "true", "0", "false"]).transform((v) => v === "1" || v === "true").optional(),
});
export type OfferQuery = z.infer<typeof OfferQuery>;

export async function listOffers(query: OfferQuery, userId?: string) {
  const where: Prisma.OfferWhereInput = {
    status: { in: ["LIVE", "PROSPECT"] },
    ...(query.category && { category: query.category }),
    ...(query.channel && { channel: query.channel }),
    // Online offers (no districts) are available everywhere.
    ...(query.district && { OR: [{ districts: { has: query.district } }, { districts: { isEmpty: true } }] }),
    ...(query.q && {
      AND: [
        {
          OR: [
            { title: { contains: query.q, mode: "insensitive" } },
            { benefit: { contains: query.q, mode: "insensitive" } },
            { category: { contains: query.q, mode: "insensitive" } },
          ],
        },
      ],
    }),
    ...(query.saved && userId && { savedBy: { some: { userId } } }),
  };
  const offers = await db.offer.findMany({
    where,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }], // LIVE sorts before PROSPECT
    select: {
      id: true, slug: true, title: true, benefit: true, howTo: true, category: true, badge: true,
      channel: true, districts: true, status: true, externalUrl: true,
      merchant: { select: { name: true } },
      sponsor: { select: { shortName: true } },
      ...(userId && { savedBy: { where: { userId }, select: { userId: true } } }),
    },
  });
  return offers.map(({ savedBy, ...o }) => ({ ...o, saved: !!savedBy?.length }));
}
export type OfferListItem = Awaited<ReturnType<typeof listOffers>>[number];

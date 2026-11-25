import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requirePoster } from "@/lib/listings";

/** Listings this poster created, with responses (student contact shared on applying). */
export const GET = handler(async () => {
  const { user } = await requirePoster();
  const listings = await db.listing.findMany({
    where: user.role === "ADMIN" ? {} : { postedById: user.id }, orderBy: { createdAt: "desc" }, take: 200,
    include: { responses: { orderBy: { createdAt: "desc" }, select: { message: true, phone: true, createdAt: true, student: { select: { user: { select: { name: true, email: true } }, institution: { select: { shortName: true } } } } } } },
  });
  return json({ listings });
});

const Input = z.object({
  kind: z.enum(["JOB", "HOUSING"]),
  title: z.string().trim().min(3).max(120),
  organisation: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(4000),
  district: z.string().trim().min(2).max(40),
  pay: z.string().trim().min(2).max(60),
  onlyMyStudents: z.boolean().default(false),
  expiresAt: z.iso.date().nullish(),
});

export const POST = handler(async (req) => {
  const { user, institutionId } = await requirePoster();
  const { onlyMyStudents, expiresAt, ...input } = await body(req, Input);
  const l = await db.listing.create({
    data: { ...input, postedById: user.id, institutionId: onlyMyStudents ? institutionId : null, expiresAt: expiresAt ? new Date(`${expiresAt}T18:29:59Z`) : null },
    select: { id: true },
  });
  return json(l, 201);
});

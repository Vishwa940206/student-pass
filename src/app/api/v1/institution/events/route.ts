import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";

const Input = z
  .object({
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(4000).default(""),
    location: z.string().trim().min(1).max(160),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }).nullish(),
    capacity: z.int().min(1).max(100_000).nullish(),
  })
  .refine((e) => !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt), { message: "End must be after start", path: ["endsAt"] });

export const POST = handler(async (req) => {
  const { user, institutionId } = await requireStaff();
  const e = await body(req, Input);
  const row = await db.event.create({
    data: {
      institutionId, createdById: user.id,
      title: e.title, description: e.description, location: e.location,
      startsAt: new Date(e.startsAt), endsAt: e.endsAt ? new Date(e.endsAt) : null, capacity: e.capacity ?? null,
    },
    select: { id: true },
  });
  return json(row, 201);
});

import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { Prisma } from "@/generated/prisma/client";

export const ProgrammeInput = z.object({
  name: z.string().trim().min(2).max(160),
  mode: z.enum(["FULL_TIME", "PART_TIME", "ONLINE"]).default("FULL_TIME"),
  durationMonths: z.int().min(1).max(120).nullish(),
  feeCents: z.int().min(0).max(1_000_000_000_00).nullish(),
  intakes: z.array(z.string().trim().min(2).max(40)).max(12).default([]),
  open: z.boolean().default(true),
});

/** Programmes offered (any staff can read; used by CRM, admissions and the enquiry page). */
export const GET = handler(async () => {
  const { institutionId } = await requireStaff();
  const programmes = await db.programme.findMany({
    where: { institutionId }, orderBy: { name: "asc" },
    include: { _count: { select: { leads: true, applications: true } } },
  });
  return json({ programmes: programmes.map(({ _count, ...p }) => ({ ...p, leads: _count.leads, applications: _count.applications })) });
});

export const POST = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  const input = await body(req, ProgrammeInput);
  try {
    return json(await db.programme.create({ data: { ...input, institutionId }, select: { id: true } }), 201);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new ApiError(409, "DUPLICATE", "A programme with that name already exists");
    throw e;
  }
});

import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { brandingOf } from "@/lib/os/branding";
import { SERVICE_IDS, STUDENT_BANDS } from "@/lib/os/services";

/** This institution's proposal requests, and its licensed modules. */
export const GET = handler(async () => {
  const { institutionId } = await requireStaff("ADMIN");
  const [requests, inst] = await Promise.all([
    db.proposalRequest.findMany({ where: { institutionId }, orderBy: { createdAt: "desc" } }),
    db.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { modules: true } }),
  ]);
  return json({ requests, modules: inst.modules });
});

const Input = z.object({
  items: z.array(z.string().refine((s) => SERVICE_IDS.includes(s), "Unknown service")).min(1).max(40),
  studentsBand: z.enum(STUDENT_BANDS).optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** Ask Student Pass for a quote on services / modules. */
export const POST = handler(async (req) => {
  const { user, institutionId } = await requireStaff("ADMIN");
  const input = await body(req, Input);
  const b = await brandingOf(institutionId);
  const r = await db.proposalRequest.create({
    data: { institutionId, institutionName: b.name, contactName: user.name, email: user.email, items: [...new Set(input.items)], studentsBand: input.studentsBand ?? null, notes: input.notes || null },
    select: { id: true },
  });
  return json(r, 201);
});

import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { SERVICE_IDS, STUDENT_BANDS } from "@/lib/os/services";
import { clientIp, limit } from "@/lib/rate-limit";

const Input = z.object({
  institutionName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  studentsBand: z.enum(STUDENT_BANDS).optional(),
  items: z.array(z.string().refine((s) => SERVICE_IDS.includes(s), "Unknown service")).min(1).max(40),
  notes: z.string().trim().max(2000).optional(),
  website: z.string().max(0, "Bot detected").optional().default(""), // honeypot
});

/** Proposal request from an institution that isn't on Student Pass yet. */
export const POST = handler(async (req) => {
  await limit("proposal:ip", clientIp(req), 5, 60 * 60);
  const input = await body(req, Input);
  await db.proposalRequest.create({ data: { institutionName: input.institutionName, contactName: input.contactName, email: input.email, items: [...new Set(input.items)], studentsBand: input.studentsBand ?? null, notes: input.notes || null } });
  return json({ ok: true }, 201);
});

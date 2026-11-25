import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { ADMISSIONS, found, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";
import { leadListSelect, logActivity } from "@/lib/os/leads";
import type { Prisma } from "@/generated/prisma/client";

const STAGES = ["NEW", "CONTACTED", "COUNSELLING", "APPLIED", "OFFER", "ENROLLED"] as const;
const SOURCES = ["WEBSITE", "STUDENT_PASS", "INSTAGRAM", "FACEBOOK", "WHATSAPP", "WALK_IN", "PHONE", "REFERRAL", "EVENT", "OTHER"] as const;

/** CRM list. Filters: stage, source, counsellor (id | "me" | "none"), programme, q, status (open | lost | all). */
export const GET = handler(async (req) => {
  const { user, institutionId } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "crm");
  const p = new URL(req.url).searchParams;
  const where: Prisma.LeadWhereInput = { institutionId };
  const status = p.get("status") ?? "open";
  if (status === "open") where.lostAt = null;
  if (status === "lost") where.lostAt = { not: null };
  const stage = p.get("stage");
  if (stage && (STAGES as readonly string[]).includes(stage)) where.stage = stage as (typeof STAGES)[number];
  const source = p.get("source");
  if (source && (SOURCES as readonly string[]).includes(source)) where.source = source as (typeof SOURCES)[number];
  const c = p.get("counsellor");
  if (c === "me") where.counsellorId = user.id;
  else if (c === "none") where.counsellorId = null;
  else if (c) where.counsellorId = c;
  if (p.get("programme")) where.programmeId = p.get("programme");
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }];
  const idle = Number(p.get("idleDays"));
  if (idle > 0) where.lastActivityAt = { lt: new Date(Date.now() - idle * 86_400_000) };

  const leads = await db.lead.findMany({ where, orderBy: { lastActivityAt: "desc" }, take: 500, select: leadListSelect });
  return json({ leads });
});

export const LeadInput = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).nullish(),
  email: z.email().trim().toLowerCase().nullish().or(z.literal("").transform(() => null)),
  district: z.string().trim().max(40).nullish(),
  source: z.enum(SOURCES),
  programmeId: z.string().nullish(),
  counsellorId: z.string().nullish(),
  consent: z.boolean().default(false),
  note: z.string().trim().max(4000).nullish(),
});

/** Add an enquiry by hand (walk-in, phone call, fair…). */
export const POST = handler(async (req) => {
  const { user, institutionId, staffRole } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "crm");
  const input = await body(req, LeadInput);
  if (!input.phone && !input.email) throw new ApiError(400, "CONTACT", "Add a phone number or email");
  if (input.programmeId) found(await db.programme.findFirst({ where: { id: input.programmeId, institutionId } }), "Programme");
  // Counsellors own what they add; admins can assign anyone at their institution.
  const counsellorId = staffRole === "COUNSELLOR" ? user.id : input.counsellorId ?? null;
  if (counsellorId && counsellorId !== user.id) {
    found(await db.institutionStaff.findFirst({ where: { userId: counsellorId, institutionId } }), "Counsellor");
  }
  const lead = await db.$transaction(async (tx) => {
    const l = await tx.lead.create({
      data: {
        institutionId, name: input.name, phone: input.phone || null, email: input.email || null, district: input.district || null,
        source: input.source, programmeId: input.programmeId || null, counsellorId, consent: input.consent,
      },
      select: { id: true },
    });
    await logActivity(tx, l.id, "SYSTEM", `Added by ${user.name}`, user.id);
    if (input.note) await logActivity(tx, l.id, "NOTE", input.note, user.id);
    return l;
  });
  return json(lead, 201);
});

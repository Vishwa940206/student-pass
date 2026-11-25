import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { ADMISSIONS, found, requireStaff } from "@/lib/campus/access";
import { leadListSelect, logActivity } from "@/lib/os/leads";
import { label, LEAD_STAGES } from "@/lib/os/labels";

/** Lead with its full activity timeline. */
export const GET = handler(async (_req, ctx: RouteContext<"/api/v1/institution/leads/[id]">) => {
  const { institutionId } = await requireStaff(...ADMISSIONS);
  const { id } = await ctx.params;
  const lead = found(await db.lead.findFirst({
    where: { id, institutionId },
    select: {
      ...leadListSelect,
      application: { select: { id: true, status: true, intake: true, statusAt: true, createdAt: true, programme: { select: { id: true, name: true } } } },
      activities: { orderBy: { createdAt: "desc" }, select: { id: true, kind: true, body: true, createdAt: true, author: { select: { name: true } } } },
    },
  }), "Lead");
  return json({ lead });
});

const Patch = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(30).nullish(),
  email: z.email().trim().toLowerCase().nullish().or(z.literal("").transform(() => null)),
  district: z.string().trim().max(40).nullish(),
  programmeId: z.string().nullish(),
  counsellorId: z.string().nullish(),
  stage: z.enum(["NEW", "CONTACTED", "COUNSELLING", "APPLIED", "OFFER", "ENROLLED"]).optional(),
  lost: z.object({ reason: z.string().trim().min(2).max(200) }).optional(),
  reopen: z.literal(true).optional(),
});

/** Edit details, assign, move stage, mark lost / reopen. Every change lands in the timeline. */
export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/leads/[id]">) => {
  const { user, institutionId, staffRole } = await requireStaff(...ADMISSIONS);
  const { id } = await ctx.params;
  const p = await body(req, Patch);
  const lead = found(await db.lead.findFirst({
    where: { id, institutionId },
    select: { stage: true, counsellorId: true, lostAt: true, application: { select: { id: true } }, programmeId: true },
  }), "Lead");

  if (p.programmeId) found(await db.programme.findFirst({ where: { id: p.programmeId, institutionId } }), "Programme");
  if (p.counsellorId !== undefined && p.counsellorId !== null) {
    found(await db.institutionStaff.findFirst({ where: { userId: p.counsellorId, institutionId } }), "Counsellor");
  }
  if (p.counsellorId !== undefined && staffRole === "COUNSELLOR" && p.counsellorId !== user.id && lead.counsellorId !== user.id) {
    throw new ApiError(403, "NOT_YOURS", "Only an admin can reassign another counsellor’s lead");
  }
  if (p.stage && lead.application && ["NEW", "CONTACTED", "COUNSELLING"].includes(p.stage)) {
    throw new ApiError(409, "HAS_APPLICATION", "This lead has an application. Change the application status instead");
  }
  if ((p.stage === "APPLIED" || p.stage === "OFFER" || p.stage === "ENROLLED") && !lead.application) {
    throw new ApiError(409, "NO_APPLICATION", "Create an application first");
  }

  await db.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    for (const k of ["name", "phone", "email", "district", "programmeId"] as const) if (p[k] !== undefined) data[k] = p[k] || null;
    if (p.name) data.name = p.name;
    if (p.counsellorId !== undefined) data.counsellorId = p.counsellorId;
    if (p.stage) data.stage = p.stage;
    if (p.lost) { data.lostAt = new Date(); data.lostReason = p.lost.reason; }
    if (p.reopen) { data.lostAt = null; data.lostReason = null; }
    await tx.lead.update({ where: { id }, data });

    if (p.stage && p.stage !== lead.stage) await logActivity(tx, id, "STAGE", `${label(LEAD_STAGES, lead.stage)} → ${label(LEAD_STAGES, p.stage)}`, user.id);
    if (p.counsellorId !== undefined && p.counsellorId !== lead.counsellorId) {
      const who = p.counsellorId ? (await tx.user.findUnique({ where: { id: p.counsellorId }, select: { name: true } }))?.name : null;
      await logActivity(tx, id, "SYSTEM", who ? `Assigned to ${who}` : "Unassigned", user.id);
    }
    if (p.lost && !lead.lostAt) await logActivity(tx, id, "SYSTEM", `Marked lost: ${p.lost.reason}`, user.id);
    if (p.reopen && lead.lostAt) await logActivity(tx, id, "SYSTEM", "Reopened", user.id);
  });
  return json({ ok: true });
});

/** Admins can delete a lead entirely (e.g. on a data-deletion request). */
export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/institution/leads/[id]">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const { count } = await db.lead.deleteMany({ where: { id, institutionId } });
  found(count || null, "Lead");
  return json({ ok: true });
});

import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { ADMISSIONS, found, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";
import { logActivity } from "@/lib/os/leads";

const Input = z.object({ programmeId: z.string().min(1), intake: z.string().trim().min(2).max(40) });

/** Turn an enquiry into an application (one per lead). The lead moves to APPLIED. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/leads/[id]/application">) => {
  const { user, institutionId } = await requireStaff(...ADMISSIONS);
  await requireModule(institutionId, "admissions");
  const { id } = await ctx.params;
  const input = await body(req, Input);
  const lead = found(await db.lead.findFirst({ where: { id, institutionId }, select: { lostAt: true, application: { select: { id: true } } } }), "Lead");
  if (lead.application) throw new ApiError(409, "EXISTS", "This lead already has an application");
  if (lead.lostAt) throw new ApiError(409, "LOST", "Reopen this lead first");
  const programme = found(await db.programme.findFirst({ where: { id: input.programmeId, institutionId }, select: { name: true, open: true } }), "Programme");
  if (!programme.open) throw new ApiError(409, "CLOSED", "That programme isn’t accepting applications");

  const app = await db.$transaction(async (tx) => {
    const a = await tx.application.create({ data: { institutionId, leadId: id, programmeId: input.programmeId, intake: input.intake }, select: { id: true } });
    await tx.lead.update({ where: { id }, data: { stage: "APPLIED", programmeId: input.programmeId } });
    await logActivity(tx, id, "STAGE", `Applied: ${programme.name} · ${input.intake}`, user.id);
    return a;
  });
  return json(app, 201);
});

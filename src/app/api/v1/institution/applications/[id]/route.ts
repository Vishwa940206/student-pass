import { z } from "zod";
import { db } from "@/lib/db";
import { handler, body, json } from "@/lib/api";
import { ADMISSIONS, found, requireStaff } from "@/lib/campus/access";
import { logActivity, stageForStatus } from "@/lib/os/leads";
import { APP_STATUSES, label } from "@/lib/os/labels";

const Input = z.object({
  status: z.enum(["UNDER_REVIEW", "OFFER_ISSUED", "ACCEPTED", "DEPOSIT_PAID", "ENROLLED", "REJECTED", "WITHDRAWN"]),
  note: z.string().trim().max(2000).optional(),
});

/** Move an application. The lead's stage follows; rejected / withdrawn marks the lead lost. */
export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/institution/applications/[id]">) => {
  const { user, institutionId } = await requireStaff(...ADMISSIONS);
  const { id } = await ctx.params;
  const { status, note } = await body(req, Input);
  const app = found(await db.application.findFirst({ where: { id, institutionId }, select: { status: true, leadId: true } }), "Application");
  if (app.status === status) return json({ ok: true });

  await db.$transaction(async (tx) => {
    await tx.application.update({ where: { id }, data: { status, statusAt: new Date() } });
    const stage = stageForStatus(status);
    const lost = status === "REJECTED" || status === "WITHDRAWN";
    await tx.lead.update({
      where: { id: app.leadId },
      data: { ...(stage && { stage }), ...(lost ? { lostAt: new Date(), lostReason: label(APP_STATUSES, status) } : { lostAt: null, lostReason: null }) },
    });
    await logActivity(tx, app.leadId, "STAGE", `Application: ${label(APP_STATUSES, app.status)} → ${label(APP_STATUSES, status)}${note ? ` · ${note}` : ""}`, user.id);
  });
  return json({ ok: true });
});

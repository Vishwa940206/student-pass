import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { ADMISSIONS, found, requireStaff } from "@/lib/campus/access";
import { logActivity } from "@/lib/os/leads";

const Input = z.object({ kind: z.enum(["NOTE", "CALL", "WHATSAPP", "EMAIL", "MEETING"]), body: z.string().trim().min(1).max(4000) });

/** Log a call, message, meeting or note. A first contact moves a NEW lead to CONTACTED. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/leads/[id]/activities">) => {
  const { user, institutionId } = await requireStaff(...ADMISSIONS);
  const { id } = await ctx.params;
  const a = await body(req, Input);
  const lead = found(await db.lead.findFirst({ where: { id, institutionId }, select: { stage: true } }), "Lead");
  await db.$transaction(async (tx) => {
    await logActivity(tx, id, a.kind, a.body, user.id);
    if (lead.stage === "NEW" && a.kind !== "NOTE") {
      await tx.lead.update({ where: { id }, data: { stage: "CONTACTED" } });
      await logActivity(tx, id, "STAGE", "New → Contacted", user.id);
    }
  });
  return json({ ok: true }, 201);
});

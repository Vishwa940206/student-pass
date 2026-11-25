import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { logActivity, pickCounsellor } from "@/lib/os/leads";
import { clientIp, limit } from "@/lib/rate-limit";

const Input = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  email: z.email().trim().toLowerCase().optional().or(z.literal("")).default(""),
  consent: z.literal(true, { error: "Please agree to be contacted" }),
}).refine((v) => v.phone || v.email, { message: "Add a phone number or email", path: ["phone"] });

/** Hand a public chat to a counsellor: creates a CRM lead with the transcript. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/public/institutions/[slug]/chat/[id]/handover">) => {
  const { slug, id } = await ctx.params;
  await limit("enquiry:ip", clientIp(req), 5, 60 * 60);
  const input = await body(req, Input);
  const conv = await db.conversation.findFirst({
    where: { id, channel: "PUBLIC", institution: { slug } },
    select: { id: true, institutionId: true, leadId: true, messages: { orderBy: { createdAt: "asc" }, select: { role: true, content: true } } },
  });
  if (!conv) throw new ApiError(404, "NOT_FOUND", "Conversation not found");
  if (conv.leadId) return json({ ok: true });
  const transcript = conv.messages.map((m) => `${m.role === "user" ? "Them" : "Assistant"}: ${m.content}`).join("\n").slice(0, 3900);
  const counsellorId = await pickCounsellor(conv.institutionId);
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: { institutionId: conv.institutionId, name: input.name, phone: input.phone || null, email: input.email || null, source: "WEBSITE", counsellorId, consent: true },
      select: { id: true },
    });
    await logActivity(tx, lead.id, "SYSTEM", "Handed over from the website assistant", null);
    if (transcript) await logActivity(tx, lead.id, "NOTE", `Chat transcript:\n${transcript}`, null);
    await tx.conversation.update({ where: { id: conv.id }, data: { leadId: lead.id, handedOver: true } });
  });
  return json({ ok: true }, 201);
});

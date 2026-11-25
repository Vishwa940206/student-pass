import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { logActivity, pickCounsellor } from "@/lib/os/leads";
import { clientIp, limit, sweepRateLimits } from "@/lib/rate-limit";

const Input = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: z.string().trim().max(30).optional().default(""),
    email: z.email().trim().toLowerCase().optional().or(z.literal("")).default(""),
    district: z.string().trim().max(40).optional().default(""),
    programmeId: z.string().optional().default(""),
    message: z.string().trim().max(2000).optional().default(""),
    consent: z.literal(true, { error: "Please agree to be contacted" }),
    website: z.string().max(0, "Bot detected").optional().default(""), // honeypot: hidden field humans leave empty
  })
  .refine((v) => v.phone || v.email, { message: "Add a phone number or email", path: ["phone"] });

/**
 * Public enquiry form → CRM lead (source WEBSITE), auto-assigned to the least-busy counsellor.
 * Rate-limited per IP and per institution; a hidden honeypot field catches simple bots.
 */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/public/institutions/[slug]/enquiries">) => {
  const { slug } = await ctx.params;
  const ip = clientIp(req);
  await limit("enquiry:ip", ip, 5, 60 * 60);
  const input = await body(req, Input);
  const inst = await db.institution.findUnique({ where: { slug }, select: { id: true } });
  if (!inst) throw new ApiError(404, "NOT_FOUND", "Institution not found");
  await limit("enquiry:inst", inst.id, 500, 24 * 60 * 60);

  let programmeId: string | null = null;
  if (input.programmeId) {
    const p = await db.programme.findFirst({ where: { id: input.programmeId, institutionId: inst.id, open: true }, select: { id: true } });
    programmeId = p?.id ?? null;
  }
  const counsellorId = await pickCounsellor(inst.id);
  await db.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        institutionId: inst.id, name: input.name, phone: input.phone || null, email: input.email || null,
        district: input.district || null, source: "WEBSITE", programmeId, counsellorId, consent: true,
      },
      select: { id: true },
    });
    await logActivity(tx, lead.id, "SYSTEM", "Enquiry from the website", null);
    if (input.message) await logActivity(tx, lead.id, "NOTE", `Message: ${input.message}`, null);
  });
  if (Math.random() < 0.02) await sweepRateLimits().catch(() => {});
  return json({ ok: true }, 201);
});

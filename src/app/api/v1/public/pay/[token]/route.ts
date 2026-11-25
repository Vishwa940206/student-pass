import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { brandingOf } from "@/lib/os/branding";
import { clientIp, limit } from "@/lib/rate-limit";

/** What a family member sees: the invoice, the institution, the student's first name only. */
export const GET = handler(async (req, ctx: RouteContext<"/api/v1/public/pay/[token]">) => {
  await limit("paylink:ip", clientIp(req), 60, 60 * 60);
  const { token } = await ctx.params;
  const inv = await db.invoice.findUnique({
    where: { payToken: token },
    select: { number: true, item: true, amountCents: true, dueDate: true, status: true, institutionId: true,
      student: { select: { user: { select: { name: true } } } },
      institution: { select: { modules: true, payhereMerchantId: true, payhereSecretEnc: true } } },
  });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "This payment link isn’t valid any more");
  return json({
    branding: await brandingOf(inv.institutionId),
    invoice: { number: inv.number, item: inv.item, amountCents: inv.amountCents, dueDate: inv.dueDate, status: inv.status },
    student: inv.student.user.name.split(" ")[0],
    payOnline: inv.status === "DUE" && inv.institution.modules.includes("payments") && Boolean(inv.institution.payhereMerchantId && inv.institution.payhereSecretEnc),
  });
});

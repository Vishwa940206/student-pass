import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";
import { tryDecrypt } from "@/lib/crypto";
import { checkoutHash, checkoutUrl, formatAmount } from "@/lib/payhere";
import { limit } from "@/lib/rate-limit";

const Input = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,15}$/, "Enter a valid mobile number"),
  city: z.string().trim().min(2).max(60).default("Colombo"),
});

/**
 * Starts a hosted PayHere checkout for one of the student's invoices. Returns the form the
 * browser posts to PayHere. The invoice is marked paid only by the signed notification.
 */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/campus/invoices/[id]/checkout">) => {
  const { user, studentId, institutionId } = await requireCampusStudent();
  await limit("checkout:student", studentId, 20, 60 * 60);
  const { id } = await ctx.params;
  const input = await body(req, Input);
  const inv = found(await db.invoice.findFirst({
    where: { id, studentId, institutionId },
    select: { id: true, number: true, item: true, amountCents: true, status: true, institution: { select: { modules: true, payhereMerchantId: true, payhereSecretEnc: true, payhereSandbox: true } } },
  }), "Invoice");
  if (inv.status !== "DUE") throw new ApiError(409, "NOT_DUE", "This invoice isn’t waiting for payment");
  const g = inv.institution;
  if (!g.modules.includes("payments") || !g.payhereMerchantId || !g.payhereSecretEnc) throw new ApiError(409, "NO_GATEWAY", "Online payment isn’t available. Please pay at the finance office");

  // Unreadable secret (e.g. SETTINGS_ENCRYPTION_KEY changed): the admin must re-enter it.
  const secret = tryDecrypt(g.payhereSecretEnc);
  if (!secret) throw new ApiError(503, "GATEWAY_CONFIG", "Online payment is temporarily unavailable. Please pay at the finance office");
  const orderId = `${inv.number}-${randomBytes(4).toString("hex")}`;
  await db.payment.create({ data: { invoiceId: inv.id, amountCents: inv.amountCents, method: "CARD_ONLINE", status: "PENDING", gatewayOrderId: orderId } });

  const origin = new URL(req.url).origin;
  const amount = formatAmount(inv.amountCents);
  const [first, ...rest] = user.name.trim().split(/\s+/);
  const fields: Record<string, string> = {
    merchant_id: g.payhereMerchantId, order_id: orderId, items: `${inv.number} · ${inv.item}`.slice(0, 100),
    currency: "LKR", amount,
    return_url: `${origin}/campus?tab=fees&paid=${encodeURIComponent(inv.number)}`,
    cancel_url: `${origin}/campus?tab=fees`,
    notify_url: `${origin}/api/v1/payments/payhere/notify`,
    first_name: first, last_name: rest.join(" ") || first, email: user.email, phone: input.phone,
    address: input.city, city: input.city, country: "Sri Lanka",
    hash: checkoutHash(g.payhereMerchantId, orderId, amount, "LKR", secret),
  };
  return json({ action: checkoutUrl(g.payhereSandbox), fields });
});

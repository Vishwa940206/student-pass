import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { tryDecrypt } from "@/lib/crypto";
import { checkoutHash, checkoutUrl, formatAmount } from "@/lib/payhere";
import { clientIp, limit } from "@/lib/rate-limit";

const Input = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().trim().toLowerCase(),
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,15}$/, "Enter a valid mobile number"),
});

/** A family member pays a shared invoice through the institution's PayHere account. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/public/pay/[token]/checkout">) => {
  await limit("paylink-checkout:ip", clientIp(req), 10, 60 * 60);
  const { token } = await ctx.params;
  const input = await body(req, Input);
  const inv = await db.invoice.findUnique({
    where: { payToken: token },
    select: { id: true, number: true, item: true, amountCents: true, status: true, institution: { select: { modules: true, payhereMerchantId: true, payhereSecretEnc: true, payhereSandbox: true } } },
  });
  if (!inv) throw new ApiError(404, "NOT_FOUND", "This payment link isn’t valid any more");
  if (inv.status !== "DUE") throw new ApiError(409, "NOT_DUE", "This invoice has already been paid");
  const g = inv.institution;
  const secret = g.payhereSecretEnc ? tryDecrypt(g.payhereSecretEnc) : null;
  if (!g.modules.includes("payments") || !g.payhereMerchantId || !secret) throw new ApiError(409, "NO_GATEWAY", "Online payment isn’t available for this institution");

  const orderId = `${inv.number}-${randomBytes(4).toString("hex")}`;
  await db.payment.create({ data: { invoiceId: inv.id, amountCents: inv.amountCents, method: "CARD_ONLINE", status: "PENDING", gatewayOrderId: orderId, payerName: input.name } });
  const origin = new URL(req.url).origin;
  const amount = formatAmount(inv.amountCents);
  const [first, ...rest] = input.name.split(/\s+/);
  return json({
    action: checkoutUrl(g.payhereSandbox),
    fields: {
      merchant_id: g.payhereMerchantId, order_id: orderId, items: `${inv.number} · ${inv.item}`.slice(0, 100), currency: "LKR", amount,
      return_url: `${origin}/pay/${token}?done=1`, cancel_url: `${origin}/pay/${token}`, notify_url: `${origin}/api/v1/payments/payhere/notify`,
      first_name: first, last_name: rest.join(" ") || first, email: input.email, phone: input.phone, address: "Sri Lanka", city: "Colombo", country: "Sri Lanka",
      hash: checkoutHash(g.payhereMerchantId, orderId, amount, "LKR", secret),
    },
  });
});

import { db } from "@/lib/db";
import { tryDecrypt } from "@/lib/crypto";
import { formatAmount, STATUS, verifyNotification } from "@/lib/payhere";

/**
 * PayHere server-to-server notification (application/x-www-form-urlencoded). This is the only
 * place an online payment becomes SUCCEEDED. Checks: known order, signature with that
 * institution's secret, merchant id, amount and currency. Idempotent; always answers quickly.
 */
export async function POST(req: Request) {
  let f: URLSearchParams;
  try { f = new URLSearchParams(await req.text()); } catch { return new Response("bad request", { status: 400 }); }
  const n = {
    merchant_id: f.get("merchant_id") ?? "", order_id: f.get("order_id") ?? "", payhere_amount: f.get("payhere_amount") ?? "",
    payhere_currency: f.get("payhere_currency") ?? "", status_code: f.get("status_code") ?? "", md5sig: f.get("md5sig") ?? "",
  };
  const paymentId = f.get("payment_id");

  const payment = await db.payment.findUnique({
    where: { gatewayOrderId: n.order_id },
    select: { id: true, status: true, amountCents: true, invoiceId: true, invoice: { select: { institution: { select: { payhereMerchantId: true, payhereSecretEnc: true } } } } },
  });
  const inst = payment?.invoice.institution;
  if (!payment || !inst?.payhereSecretEnc || inst.payhereMerchantId !== n.merchant_id) return new Response("unknown order", { status: 400 });
  const secret = tryDecrypt(inst.payhereSecretEnc);
  if (!secret) return new Response("gateway not configured", { status: 503 }); // PayHere retries; fix settings
  if (!verifyNotification(n, secret)) return new Response("bad signature", { status: 400 });
  if (n.payhere_currency !== "LKR" || n.payhere_amount !== formatAmount(payment.amountCents)) return new Response("amount mismatch", { status: 400 });

  await db.$transaction(async (tx) => {
    const base = { gatewayStatus: n.status_code, ...(paymentId && { reference: paymentId }) };
    if (n.status_code === STATUS.SUCCESS) {
      if (payment.status === "SUCCEEDED") return; // retry of a notification we already applied
      await tx.payment.update({ where: { id: payment.id }, data: { ...base, status: "SUCCEEDED" } });
      await tx.invoice.updateMany({ where: { id: payment.invoiceId, status: "DUE" }, data: { status: "PAID", paidAt: new Date() } });
    } else if (n.status_code === STATUS.CHARGEDBACK) {
      await tx.payment.update({ where: { id: payment.id }, data: { ...base, status: "FAILED" } });
      // Money was taken back: the invoice is owed again unless another payment covers it.
      const other = await tx.payment.count({ where: { invoiceId: payment.invoiceId, status: "SUCCEEDED", id: { not: payment.id } } });
      if (!other) await tx.invoice.updateMany({ where: { id: payment.invoiceId, status: "PAID" }, data: { status: "DUE", paidAt: null } });
    } else if (payment.status === "PENDING") {
      const status = n.status_code === STATUS.CANCELED ? "CANCELLED" : n.status_code === STATUS.FAILED ? "FAILED" : "PENDING";
      await tx.payment.update({ where: { id: payment.id }, data: { ...base, status } });
    }
  });
  return new Response("ok");
}

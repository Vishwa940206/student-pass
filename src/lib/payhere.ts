import "server-only";
import { createHash } from "node:crypto";

// PayHere Checkout API (https://support.payhere.lk/api-&-mobile-sdk/checkout-api).
export const checkoutUrl = (sandbox: boolean) =>
  sandbox ? "https://sandbox.payhere.lk/pay/checkout" : "https://www.payhere.lk/pay/checkout";

const md5u = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();

/** LKR cents → "1234.50" (two decimals, dot, no thousands separator). */
export const formatAmount = (cents: number) => (cents / 100).toFixed(2);

/** hash = UPPER(md5(merchant_id + order_id + amount + currency + UPPER(md5(secret)))) */
export const checkoutHash = (merchantId: string, orderId: string, amount: string, currency: string, secret: string) =>
  md5u(merchantId + orderId + amount + currency + md5u(secret));

/** md5sig = UPPER(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + UPPER(md5(secret)))) */
export function verifyNotification(
  n: { merchant_id: string; order_id: string; payhere_amount: string; payhere_currency: string; status_code: string; md5sig: string },
  secret: string,
): boolean {
  const expected = md5u(n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5u(secret));
  const a = Buffer.from(expected), b = Buffer.from((n.md5sig ?? "").toUpperCase());
  return a.length === b.length && createHash("sha256").update(a).digest().equals(createHash("sha256").update(b).digest());
}

export const STATUS = { SUCCESS: "2", PENDING: "0", CANCELED: "-1", FAILED: "-2", CHARGEDBACK: "-3" } as const;

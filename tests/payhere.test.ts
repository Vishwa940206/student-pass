import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkoutHash, formatAmount, verifyNotification } from "@/lib/payhere";

const md5u = (s: string) => createHash("md5").update(s).digest("hex").toUpperCase();
const SECRET = "MzQ5NTg0MjM3MjE2MDcxNjA3NDQxNjY0NjkzODIxMTM0OTg2MjU=";

describe("PayHere", () => {
  it("formats amounts with two decimals and no separators", () => {
    expect(formatAmount(125000_00)).toBe("125000.00");
    expect(formatAmount(1050)).toBe("10.50");
    expect(formatAmount(5)).toBe("0.05");
  });

  it("builds the checkout hash per the documented formula", () => {
    const h = checkoutHash("1211149", "INV-00001-ab12", "1000.00", "LKR", SECRET);
    expect(h).toBe(md5u("1211149" + "INV-00001-ab12" + "1000.00" + "LKR" + md5u(SECRET)));
    expect(h).toMatch(/^[0-9A-F]{32}$/);
  });

  const notice = (over: Partial<Record<string, string>> = {}) => {
    const n = { merchant_id: "1211149", order_id: "INV-00001-ab12", payhere_amount: "1000.00", payhere_currency: "LKR", status_code: "2", ...over };
    const md5sig = md5u(n.merchant_id + n.order_id + n.payhere_amount + n.payhere_currency + n.status_code + md5u(SECRET));
    return { ...n, md5sig };
  };

  it("accepts a correctly signed notification", () => {
    expect(verifyNotification(notice(), SECRET)).toBe(true);
    expect(verifyNotification({ ...notice(), md5sig: notice().md5sig.toLowerCase() }, SECRET)).toBe(true);
  });

  it("rejects tampering with amount, status or secret", () => {
    expect(verifyNotification({ ...notice(), payhere_amount: "1.00" }, SECRET)).toBe(false);
    expect(verifyNotification({ ...notice({ status_code: "-2" }), status_code: "2" }, SECRET)).toBe(false);
    expect(verifyNotification(notice(), "wrong-secret")).toBe(false);
    expect(verifyNotification({ ...notice(), md5sig: "" }, SECRET)).toBe(false);
  });
});

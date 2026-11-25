import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { encrypt, encryptionConfigured, tryDecrypt } from "@/lib/crypto";

/** Online payment settings (PayHere). The secret is never returned. */
export const GET = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  const i = await db.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { payhereMerchantId: true, payhereSecretEnc: true, payhereSandbox: true, modules: true } });
  return json({
    merchantId: i.payhereMerchantId, hasSecret: Boolean(i.payhereSecretEnc), sandbox: i.payhereSandbox,
    secretReadable: i.payhereSecretEnc ? tryDecrypt(i.payhereSecretEnc) !== null : null, // false → re-enter the secret
    enabled: i.modules.includes("payments"), encryptionReady: encryptionConfigured(),
    notifyUrl: `${new URL(req.url).origin}/api/v1/payments/payhere/notify`,
  });
});

const Input = z.object({
  merchantId: z.string().trim().regex(/^\d{4,12}$/, "PayHere merchant IDs are digits").nullish(),
  secret: z.string().trim().min(8).max(200).optional(), // omit to keep the current one
  sandbox: z.boolean().optional(),
});

export const PATCH = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  const input = await body(req, Input);
  if (input.secret && !encryptionConfigured()) throw new ApiError(503, "NO_KEY", "Online payments aren’t set up on this server yet (missing encryption key)");
  await db.institution.update({
    where: { id: institutionId },
    data: {
      ...(input.merchantId !== undefined && { payhereMerchantId: input.merchantId || null }),
      ...(input.secret && { payhereSecretEnc: encrypt(input.secret) }),
      ...(input.sandbox !== undefined && { payhereSandbox: input.sandbox }),
    },
  });
  return json({ ok: true });
});

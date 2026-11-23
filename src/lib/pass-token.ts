import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Rotating pass token shown as the student's QR code.
 *
 *   SP1.<passId>.<step>.<signature>
 *
 * - passId is an opaque id — never the student's name, institution or balances.
 * - step is the 30-second window number; the token changes every window.
 * - signature is an HMAC over the rest with a server-only secret, so tokens
 *   cannot be forged, and a screenshot stops working within ~1 minute.
 */
export const TOKEN_PERIOD_SECONDS = 30;
const VERSION = "SP1";
const SIG_LENGTH = 22; // 132 bits of base64url HMAC-SHA256 — plenty, keeps the QR small

export type TokenCheck =
  | { ok: true; passId: string; step: number }
  | { ok: false; reason: "MALFORMED" | "BAD_SIGNATURE" | "EXPIRED" };

function secret(): string {
  const s = process.env.PASS_TOKEN_SECRET;
  if (!s || s.length < 32) throw new Error("PASS_TOKEN_SECRET must be set (32+ chars)");
  return s;
}

export const currentStep = (nowMs = Date.now()) => Math.floor(nowMs / 1000 / TOKEN_PERIOD_SECONDS);

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("base64url").slice(0, SIG_LENGTH);
}

export function issueToken(passId: string, nowMs = Date.now(), key = secret()) {
  const step = currentStep(nowMs);
  const payload = `${VERSION}.${passId}.${step}`;
  const expiresAtMs = (step + 1) * TOKEN_PERIOD_SECONDS * 1000;
  return { token: `${payload}.${sign(payload, key)}`, step, expiresAtMs };
}

/** Accepts the current window and the one before it (scanning lag at the till). */
export function verifyToken(token: string, nowMs = Date.now(), key = secret()): TokenCheck {
  const parts = token.trim().split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return { ok: false, reason: "MALFORMED" };
  const [, passId, stepStr, sig] = parts;
  if (!/^[a-z0-9]{10,40}$/i.test(passId) || !/^\d{1,12}$/.test(stepStr)) {
    return { ok: false, reason: "MALFORMED" };
  }
  const step = Number(stepStr);
  const expected = Buffer.from(sign(`${VERSION}.${passId}.${step}`, key));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  const now = currentStep(nowMs);
  if (step > now || step < now - 1) return { ok: false, reason: "EXPIRED" };
  return { ok: true, passId, step };
}

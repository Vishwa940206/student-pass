import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for secrets stored in the database (e.g. an institution's payment-gateway
 * secret). Key: SETTINGS_ENCRYPTION_KEY = 32 random bytes, base64 (openssl rand -base64 32).
 * Format: v1.<iv b64>.<tag b64>.<ciphertext b64>
 */
function key(): Buffer {
  const k = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!k) throw new Error("SETTINGS_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64)");
  return buf;
}

export const encryptionConfigured = () => {
  try { key(); return true; } catch { return false; }
};

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(stored: string): string {
  const [v, iv, tag, data] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
}

/** decrypt(), or null if the value can't be read (missing key, key changed, corrupted). */
export function tryDecrypt(stored: string): string | null {
  try { return decrypt(stored); } catch (e) { console.error("tryDecrypt:", (e as Error).message); return null; }
}

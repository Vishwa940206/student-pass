import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/lib/crypto";

beforeAll(() => { process.env.SETTINGS_ENCRYPTION_KEY = randomBytes(32).toString("base64"); });

describe("settings encryption", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encrypt("merchant-secret"), b = encrypt("merchant-secret");
    expect(a).not.toBe(b);
    expect(a).not.toContain("merchant-secret");
    expect(decrypt(a)).toBe("merchant-secret");
  });

  it("detects tampering", () => {
    const [v, iv, tag, data] = encrypt("merchant-secret").split(".");
    const flipped = Buffer.from(data, "base64"); flipped[0] ^= 1;
    expect(() => decrypt([v, iv, tag, flipped.toString("base64")].join("."))).toThrow();
  });

  it("refuses a missing or short key", () => {
    const k = process.env.SETTINGS_ENCRYPTION_KEY;
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encrypt("x")).toThrow(/32 bytes/);
    process.env.SETTINGS_ENCRYPTION_KEY = k;
  });
});

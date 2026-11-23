import { describe, expect, it } from "vitest";
import { issueToken, verifyToken, TOKEN_PERIOD_SECONDS } from "@/lib/pass-token";

const KEY = "test-secret-test-secret-test-secret-1234";
const PASS = "ckpass0000000000000000001";
const T0 = 1_800_000_000_000;
const P = TOKEN_PERIOD_SECONDS * 1000;

describe("pass tokens", () => {
  it("round-trips and carries no personal data", () => {
    const { token } = issueToken(PASS, T0, KEY);
    expect(token.split(".")).toHaveLength(4);
    expect(verifyToken(token, T0, KEY)).toMatchObject({ ok: true, passId: PASS });
  });

  it("accepts the previous window but not older ones", () => {
    const { token } = issueToken(PASS, T0, KEY);
    expect(verifyToken(token, T0 + P, KEY).ok).toBe(true);
    expect(verifyToken(token, T0 + 2 * P, KEY)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects tokens from the future", () => {
    const { token } = issueToken(PASS, T0 + P, KEY);
    expect(verifyToken(token, T0, KEY)).toEqual({ ok: false, reason: "EXPIRED" });
  });

  it("rejects tampering and wrong keys", () => {
    const { token } = issueToken(PASS, T0, KEY);
    const [v, id, step, sig] = token.split(".");
    expect(verifyToken(`${v}.${id}.${Number(step) + 1}.${sig}`, T0 + P, KEY).ok).toBe(false);
    expect(verifyToken(`${v}.ckpass0000000000000000002.${step}.${sig}`, T0, KEY)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
    expect(verifyToken(token, T0, KEY + "x")).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects garbage", () => {
    for (const t of ["", "hello", "SP1.a.b.c", "SP2.ckpass0000000000000000001.1.x", "SP1.../.1.x"]) {
      expect(verifyToken(t, T0, KEY)).toEqual({ ok: false, reason: "MALFORMED" });
    }
  });
});

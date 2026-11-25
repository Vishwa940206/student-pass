import "server-only";
import { randomInt } from "node:crypto";

/** Short human code without look-alikes (no 0/O, 1/I/L), e.g. for collection and reward codes. */
export function humanCode(len = 8): string {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += a[randomInt(a.length)];
  return s;
}

import { describe, expect, it } from "vitest";
import { startOfColomboWeek, startOfColomboYear } from "@/lib/time";

describe("Colombo week/year boundaries", () => {
  it("Monday 00:00 +05:30 is 18:30Z on Sunday", () => {
    // Wed 2026-11-25 12:00 Colombo
    expect(startOfColomboWeek(new Date("2026-11-25T06:30:00Z")).toISOString()).toBe("2026-11-22T18:30:00.000Z");
  });
  it("Sunday 23:59 Colombo still belongs to the previous week", () => {
    expect(startOfColomboWeek(new Date("2026-11-29T18:29:00Z")).toISOString()).toBe("2026-11-22T18:30:00.000Z");
  });
  it("Monday 00:00 Colombo starts a new week", () => {
    expect(startOfColomboWeek(new Date("2026-11-29T18:30:00Z")).toISOString()).toBe("2026-11-29T18:30:00.000Z");
  });
  it("new year in Colombo before UTC", () => {
    expect(startOfColomboYear(new Date("2026-12-31T19:00:00Z")).toISOString()).toBe("2026-12-31T18:30:00.000Z");
  });
});

// Sri Lanka is UTC+05:30 all year (no daylight saving), so a fixed offset is exact.
const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Start of the current week — Monday 00:00 Asia/Colombo — as a UTC Date. */
export function startOfColomboWeek(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - daysSinceMonday);
  return new Date(local.getTime() - COLOMBO_OFFSET_MS);
}

/** Start of the current calendar year in Asia/Colombo, as a UTC Date. */
export function startOfColomboYear(now: Date = new Date()): Date {
  const local = new Date(now.getTime() + COLOMBO_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), 0, 1) - COLOMBO_OFFSET_MS);
}

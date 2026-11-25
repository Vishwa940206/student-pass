// Date formatting for the browser. Campus times are shown in Sri Lanka time
// whatever the device's timezone, so a lecture at 9:00 reads 9:00 everywhere.
const TZ = "Asia/Colombo";

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" });

export const fmtDateTime = (d: string | Date) =>
  new Date(d).toLocaleString("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export const fmtTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("en-GB", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

/** "in 3 days", "2 days ago", "today". */
export function relDays(d: string | Date): string {
  const days = Math.round((new Date(d).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/**
 * <input type="datetime-local"> gives "2026-12-01T18:00" with no zone. Staff enter
 * Sri Lanka time, so attach +05:30 (Sri Lanka has no daylight saving).
 */
export const colomboIso = (local: string) => (local ? `${local.length === 16 ? `${local}:00` : local}+05:30` : "");

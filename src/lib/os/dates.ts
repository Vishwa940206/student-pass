import "server-only";
export const fmtDateServer = (d: Date) => d.toLocaleDateString("en-GB", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" });

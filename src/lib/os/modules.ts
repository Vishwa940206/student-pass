// Licensed Institution OS modules (shared by browser and server).
export const MODULES = [
  ["crm", "CRM"], ["admissions", "Admissions"], ["analytics", "Analytics & BI"], ["market", "Market intelligence"],
  ["lms", "LMS (content & attendance)"], ["fees", "Fees"], ["ai", "Conversational AI"], ["payments", "Online payments"],
] as const;
export type ModuleKey = (typeof MODULES)[number][0];
export const ALL_MODULES = MODULES.map(([k]) => k) as ModuleKey[];

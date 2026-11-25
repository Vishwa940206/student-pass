// Shared (browser + server) labels and order for Institution OS enums.

export const LEAD_SOURCES = [
  ["WEBSITE", "Enquiry page"], ["STUDENT_PASS", "Student Pass"], ["INSTAGRAM", "Instagram"], ["FACEBOOK", "Facebook"],
  ["WHATSAPP", "WhatsApp"], ["WALK_IN", "Walk-in"], ["PHONE", "Phone"], ["REFERRAL", "Referral"], ["EVENT", "Event / fair"], ["OTHER", "Other"],
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number][0];

export const LEAD_STAGES = [
  ["NEW", "New"], ["CONTACTED", "Contacted"], ["COUNSELLING", "Counselling"], ["APPLIED", "Applied"], ["OFFER", "Offer"], ["ENROLLED", "Enrolled"],
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number][0];
export const stageIndex = (s: LeadStage) => LEAD_STAGES.findIndex(([v]) => v === s);

export const APP_STATUSES = [
  ["UNDER_REVIEW", "Under review"], ["OFFER_ISSUED", "Offer issued"], ["ACCEPTED", "Accepted"], ["DEPOSIT_PAID", "Deposit paid"],
  ["ENROLLED", "Enrolled"], ["REJECTED", "Rejected"], ["WITHDRAWN", "Withdrawn"],
] as const;
export type AppStatus = (typeof APP_STATUSES)[number][0];

export const ACTIVITY_KINDS = [["NOTE", "Note"], ["CALL", "Call"], ["WHATSAPP", "WhatsApp"], ["EMAIL", "Email"], ["MEETING", "Meeting"]] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number][0];

export const STUDY_MODES = [["FULL_TIME", "Full-time"], ["PART_TIME", "Part-time"], ["ONLINE", "Online"]] as const;

export const label = <T extends string>(list: readonly (readonly [T, string])[], v: T | null | undefined) =>
  (v && list.find(([k]) => k === v)?.[1]) ?? "—";

export const DISTRICTS = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo", "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar", "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya",
] as const;

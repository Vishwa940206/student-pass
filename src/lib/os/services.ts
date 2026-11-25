// B2B services catalogue (from the design prototype). Prices are quoted per institution.
type Service = readonly [id: string, name: string, unit: string];
export const SERVICE_GROUPS: readonly (readonly [group: string, items: readonly Service[]])[] = [
  ["Platform licences", [
    ["crm", "Edification CRM", "per counsellor seat"], ["adm", "Admissions & Offerletter", "per application"],
    ["lms", "LMS", "per active learner"], ["ai", "Conversational AI", "per conversation band"],
    ["bi", "BI brain & analytics", "per institution"], ["pay", "Payments", "per transaction"],
  ]],
  ["Launch services", [
    ["wl", "White-label setup", "domain, brand, app"], ["mig", "Data migration", "leads, learners, content"],
    ["sso", "SSO & SIS integration", "per system"], ["train", "Staff training", "per cohort"],
  ]],
  ["Growth services", [
    ["mkt", "Marketplace listing", "per programme"], ["camp", "Campaigns & creative", "monthly retainer"],
    ["coun", "Counselling as a service", "per enrolment"], ["ev", "Open days & events", "per event"],
  ]],
  ["Data & AI", [["kb", "AI knowledge onboarding", "one-off"], ["rep", "Market intelligence reports", "quarterly"], ["bix", "Custom dashboards", "per dashboard"]]],
  ["Student perks", [["perk", "Sponsored perks programme", "budget + management fee"], ["card", "Co-branded Student Pass cards", "per card"]]],
];
export const SERVICE_IDS: string[] = SERVICE_GROUPS.flatMap(([, items]) => items.map(([id]) => id));
export const serviceName = (id: string) => SERVICE_GROUPS.flatMap(([, i]) => i).find(([k]) => k === id)?.[1] ?? id;
export const STUDENT_BANDS = ["Under 500", "500–2,000", "2,000–10,000", "10,000+"] as const;

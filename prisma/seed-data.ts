/* Real reference data shared by the dev and production seeds. */
import type { InstitutionType, Channel } from "../src/generated/prisma/client";

export const TYPE: Record<string, InstitutionType> = {
  "UGC university": "UGC_UNIVERSITY",
  "Public university": "PUBLIC_UNIVERSITY",
  "Degree-awarding · Sec. 25A": "DEGREE_AWARDING",
  "Foreign-degree provider": "FOREIGN_DEGREE_PROVIDER",
};
export const INSTS: [string, string, string, string][] = [
  ["University of Colombo", "UoC", "Colombo", "UGC university"], ["University of Peradeniya", "UoP", "Kandy", "UGC university"],
  ["University of Sri Jayewardenepura", "USJ", "Colombo", "UGC university"], ["University of Kelaniya", "UoK", "Gampaha", "UGC university"],
  ["University of Moratuwa", "UoM", "Colombo", "UGC university"], ["University of Jaffna", "UoJ", "Jaffna", "UGC university"],
  ["University of Ruhuna", "UoR", "Matara", "UGC university"], ["The Open University of Sri Lanka", "OUSL", "Colombo", "UGC university"],
  ["Eastern University, Sri Lanka", "EUSL", "Batticaloa", "UGC university"], ["South Eastern University of Sri Lanka", "SEUSL", "Ampara", "UGC university"],
  ["Rajarata University of Sri Lanka", "RUSL", "Anuradhapura", "UGC university"], ["Sabaragamuwa University of Sri Lanka", "SUSL", "Ratnapura", "UGC university"],
  ["Wayamba University of Sri Lanka", "WUSL", "Kurunegala", "UGC university"], ["Uva Wellassa University of Sri Lanka", "UWU", "Badulla", "UGC university"],
  ["University of the Visual and Performing Arts", "UVPA", "Colombo", "UGC university"], ["Gampaha Wickramarachchi University of Indigenous Medicine", "GWUIM", "Gampaha", "UGC university"],
  ["University of Vavuniya", "UoV", "Vavuniya", "UGC university"], ["General Sir John Kotelawala Defence University", "KDU", "Colombo", "Public university"],
  ["University of Vocational Technology", "UoVT", "Colombo", "Public university"], ["SLIIT", "SLIIT", "Colombo", "Degree-awarding · Sec. 25A"],
  ["NSBM Green University", "NSBM", "Colombo", "Degree-awarding · Sec. 25A"], ["CINEC Campus", "CINEC", "Colombo", "Degree-awarding · Sec. 25A"],
  ["SLTC Research University", "SLTC", "Colombo", "Degree-awarding · Sec. 25A"], ["Horizon Campus", "HC", "Colombo", "Degree-awarding · Sec. 25A"],
  ["KIU", "KIU", "Colombo", "Degree-awarding · Sec. 25A"], ["IIT", "IIT", "Colombo", "Foreign-degree provider"],
  ["APIIT Sri Lanka", "APIIT", "Colombo", "Foreign-degree provider"], ["Inspire College", "IC", "Colombo", "Foreign-degree provider"],
];

// Browse-only catalogue from the prototype. PROSPECT = terms not yet confirmed, not redeemable.
export const CATALOGUE: { slug: string; title: string; category: string; badge: string; benefit: string; channel: Channel; districts: string[]; howTo: string }[] = [
  { slug: "cafes", title: "Independent cafés", category: "Food & drink", badge: "Café", benefit: "Offers at neighbourhood cafés, tea shops and bakeries near campus.", channel: "IN_STORE", districts: ["Colombo", "Kandy", "Galle", "Jaffna"], howTo: "Each café sets its own offer and hours." },
  { slug: "cinema", title: "Cinemas", category: "Cinema & events", badge: "Reel", benefit: "Student ticket and concession offers.", channel: "IN_STORE", districts: ["Colombo", "Gampaha", "Kandy"], howTo: "Show your pass at the box office." },
  { slug: "events", title: "Concerts & events", category: "Cinema & events", badge: "Live", benefit: "Student pricing and limited giveaways for campus events.", channel: "ONLINE", districts: ["Colombo"], howTo: "Limited inventory; per-member limits apply." },
  { slug: "gyms", title: "Gyms & studios", category: "Fitness", badge: "Lift", benefit: "Student memberships, class packs and pool access.", channel: "IN_STORE", districts: ["Colombo", "Gampaha", "Kurunegala"], howTo: "Verify at the front desk with your pass." },
  { slug: "ai", title: "AI study tools", category: "AI & productivity", badge: "AI", benefit: "Student plans for AI assistants and writing tools, where providers offer them.", channel: "ONLINE", districts: [], howTo: "Redeemed on the provider’s own site with their verification." },
  { slug: "design", title: "Design & video apps", category: "Design & media", badge: "Edit", benefit: "Education plans for design, video and prototyping tools.", channel: "ONLINE", districts: [], howTo: "Provider-managed plans; terms vary." },
  { slug: "stream", title: "Music & video streaming", category: "Music & streaming", badge: "Play", benefit: "Student plans where available in Sri Lanka.", channel: "ONLINE", districts: [], howTo: "Availability in Sri Lanka is being checked per provider." },
  { slug: "print", title: "Books, stationery & printing", category: "Essentials", badge: "Ink", benefit: "Campus essentials for less.", channel: "IN_STORE", districts: ["Colombo", "Kandy", "Jaffna", "Galle"], howTo: "Show your pass at checkout." },
  { slug: "data", title: "Mobile data & laptops", category: "Essentials", badge: "GB", benefit: "Student data bundles and device offers.", channel: "ONLINE", districts: [], howTo: "Partner terms to be confirmed." },
];

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

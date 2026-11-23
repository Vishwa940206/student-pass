/* Development seed — idempotent (safe to re-run). Data mirrors the prototype. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type InstitutionType, type Channel } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DEV_PASSWORD = "studentpass";

const TYPE: Record<string, InstitutionType> = {
  "UGC university": "UGC_UNIVERSITY",
  "Public university": "PUBLIC_UNIVERSITY",
  "Degree-awarding · Sec. 25A": "DEGREE_AWARDING",
  "Foreign-degree provider": "FOREIGN_DEGREE_PROVIDER",
};
const INSTS: [string, string, string, string][] = [
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
const CATALOGUE: { slug: string; title: string; category: string; badge: string; benefit: string; channel: Channel; districts: string[]; howTo: string }[] = [
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

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const passwordHash = await hashPassword(DEV_PASSWORD);

  const inst: Record<string, string> = {};
  for (const [name, shortName, district, type] of INSTS) {
    const slug = slugify(shortName);
    const row = await db.institution.upsert({
      where: { slug },
      update: { name, shortName, district, type: TYPE[type], isPartner: shortName === "IC" },
      create: { slug, name, shortName, district, type: TYPE[type], isPartner: shortName === "IC" },
    });
    inst[shortName] = row.id;
  }

  // ── Fictional sandbox merchant for POS testing ──
  const merchant = await db.merchant.upsert({
    where: { slug: "sandbox-cafe" },
    update: {},
    create: { slug: "sandbox-cafe", name: "Sandbox Café" },
  });
  const branches = [
    { code: "KOL", name: "Kollupitiya", district: "Colombo", inProgramme: true },
    { code: "NUG", name: "Nugegoda", district: "Colombo", inProgramme: true },
    { code: "GAL", name: "Galle Fort", district: "Galle", inProgramme: false },
  ];
  for (const b of branches) {
    await db.merchantLocation.upsert({
      where: { merchantId_code: { merchantId: merchant.id, code: b.code } },
      update: b,
      create: { ...b, merchantId: merchant.id },
    });
  }

  const liveOffers = [
    {
      slug: "sandbox-student-coffee", title: "Student coffee — 10% off", category: "Food & drink", badge: "Brew",
      benefit: "10% off your order at participating Sandbox Café branches.", howTo: "Show your pass QR at the counter.",
      channel: "IN_STORE" as const, districts: ["Colombo"], discountType: "PERCENT" as const, discountValue: 1000, maxDiscountCents: 50_000,
    },
    {
      slug: "ic-weekly-coffee", title: "Inspire College weekly coffee", category: "Food & drink", badge: "1×",
      benefit: "One sponsored coffee every week for verified Inspire College students.",
      howTo: "Weekly allowance resets Monday 00:00 (Asia/Colombo). Regular sizes.",
      channel: "IN_STORE" as const, districts: ["Colombo"], discountType: "SPONSORED" as const, discountValue: 95_000,
      sponsorId: inst.IC, sponsorBudgetCents: 190_000_00, limitPerWeek: 1, limitPerYear: 48,
    },
  ];
  for (const o of liveOffers) {
    const data = { ...o, merchantId: merchant.id, status: "LIVE" as const };
    await db.offer.upsert({ where: { slug: o.slug }, update: data, create: data });
  }
  for (const o of CATALOGUE) {
    await db.offer.upsert({ where: { slug: o.slug }, update: { ...o, status: "PROSPECT" }, create: { ...o, status: "PROSPECT" } });
  }

  // ── Demo accounts (password: studentpass) ──
  const validUntil = new Date("2027-06-30T18:29:59Z");
  const students = [
    { email: "nethmi@example.com", name: "Nethmi Perera", inst: "IC", no: "IC-2026-0142", programme: "BSc Computing", status: "VERIFIED" as const, passState: "ACTIVE" as const },
    { email: "kasun@example.com", name: "Kasun Rajapaksha", inst: "UoM", no: "220481K", programme: "BSc Engineering", status: "VERIFIED" as const, passState: "ACTIVE" as const },
    { email: "ishara@example.com", name: "Ishara Fernando", inst: "SLIIT", no: "IT22100345", programme: "BSc IT", status: "VERIFIED" as const, passState: "FROZEN" as const },
    { email: "amaya@example.com", name: "Amaya Silva", inst: "UoC", no: "2025/CS/118", programme: "BSc Computer Science", status: "PENDING" as const, passState: "ACTIVE" as const },
  ];
  for (const s of students) {
    const user = await db.user.upsert({
      where: { email: s.email },
      update: { name: s.name, passwordHash },
      create: { email: s.email, name: s.name, passwordHash, role: "STUDENT" },
    });
    const profile = {
      institutionId: inst[s.inst], studentNumber: s.no, programme: s.programme, verificationStatus: s.status,
      verifiedAt: s.status === "VERIFIED" ? new Date() : null, validUntil: s.status === "VERIFIED" ? validUntil : null, passState: s.passState,
    };
    await db.studentProfile.upsert({ where: { userId: user.id }, update: profile, create: { ...profile, userId: user.id } });
  }

  const cashier = await db.user.upsert({
    where: { email: "cashier@sandbox-cafe.example" },
    update: { passwordHash },
    create: { email: "cashier@sandbox-cafe.example", name: "Sandbox Cashier", passwordHash, role: "MERCHANT_STAFF" },
  });
  await db.merchantStaff.upsert({ where: { userId: cashier.id }, update: { merchantId: merchant.id }, create: { userId: cashier.id, merchantId: merchant.id } });

  await db.user.upsert({
    where: { email: "admin@studentpass.example" },
    update: { passwordHash },
    create: { email: "admin@studentpass.example", name: "Student Pass Admin", passwordHash, role: "ADMIN" },
  });

  const counts = await Promise.all([db.institution.count(), db.offer.count(), db.user.count()]);
  console.log(`Seeded: ${counts[0]} institutions, ${counts[1]} offers, ${counts[2]} users (password: ${DEV_PASSWORD})`);
}

main().finally(() => db.$disconnect());

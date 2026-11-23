/* Development seed — idempotent (safe to re-run). Data mirrors the prototype. */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TYPE, INSTS, CATALOGUE, slugify } from "./seed-data";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const DEV_PASSWORD = "studentpass";

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

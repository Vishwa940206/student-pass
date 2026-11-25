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

  // ── Campus Life + Institution OS demo (Inspire College) ──
  const ic = inst.IC;
  const staffAccounts = [
    { email: "registrar@inspire-college.example", name: "Dilani Jayasuriya", staffRole: "ADMIN" as const },
    { email: "lecturer@inspire-college.example", name: "Ruwan Fernando", staffRole: "LECTURER" as const },
  ];
  const staffIds: string[] = [];
  for (const a of staffAccounts) {
    const u = await db.user.upsert({
      where: { email: a.email },
      update: { passwordHash, role: "INSTITUTION_STAFF" },
      create: { email: a.email, name: a.name, passwordHash, role: "INSTITUTION_STAFF" },
    });
    await db.institutionStaff.upsert({
      where: { userId: u.id },
      update: { institutionId: ic, staffRole: a.staffRole },
      create: { userId: u.id, institutionId: ic, staffRole: a.staffRole },
    });
    staffIds.push(u.id);
  }
  const [registrarId, lecturerId] = staffIds;
  const nethmi = await db.studentProfile.findFirstOrThrow({ where: { user: { email: "nethmi@example.com" } } });

  // Campus content is recreated on every seed run so dates stay relative to today.
  await db.announcement.deleteMany({ where: { institutionId: ic } });
  await db.event.deleteMany({ where: { institutionId: ic } });
  await db.club.deleteMany({ where: { institutionId: ic } });
  await db.course.deleteMany({ where: { institutionId: ic } });
  const day = (n: number, h = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };

  await db.announcement.createMany({ data: [
    { institutionId: ic, authorId: registrarId, pinned: true, title: "Semester 2 timetable is out", body: "Check your course pages for updated lecture rooms. Labs start in week 2." },
    { institutionId: ic, authorId: lecturerId, title: "Library hours extended", body: "The library is open until 10 pm on weekdays during the exam period." },
  ] });
  const fresh = await db.event.create({ data: { institutionId: ic, createdById: registrarId, title: "Freshers’ Night", description: "Music, food and every club in one hall.", location: "Main hall", startsAt: day(3, 18), endsAt: day(3, 22), capacity: 300 } });
  await db.event.create({ data: { institutionId: ic, createdById: lecturerId, title: "Hack the Campus — 24h hackathon", description: "Teams of up to four. Mentors on site.", location: "Computing labs", startsAt: day(10, 9), endsAt: day(11, 9), capacity: 2 } });
  await db.eventRsvp.create({ data: { eventId: fresh.id, studentId: nethmi.id } });
  const coding = await db.club.create({ data: { institutionId: ic, name: "Coding Club", description: "Weekly build nights and hackathon prep." } });
  await db.club.create({ data: { institutionId: ic, name: "Photography Society", description: "Photo walks around Colombo every other Saturday." } });
  await db.clubMember.create({ data: { clubId: coding.id, studentId: nethmi.id } });
  const cs = await db.course.create({ data: { institutionId: ic, code: "CS101", name: "Programming Foundations", lecturerId } });
  await db.course.create({ data: { institutionId: ic, code: "WEB201", name: "Web Development", lecturerId } });
  await db.enrolment.create({ data: { courseId: cs.id, studentId: nethmi.id } });
  const a1 = await db.assignment.create({ data: { courseId: cs.id, title: "Lab 1 · Variables and loops", dueAt: day(-7, 23), maxMarks: 20 } });
  await db.assignment.create({ data: { courseId: cs.id, title: "Mid-term project", description: "Build a small command-line app. Submit via the lab portal.", dueAt: day(5, 23), maxMarks: 100 } });
  await db.grade.create({ data: { assignmentId: a1.id, studentId: nethmi.id, marks: 17, feedback: "Clean code. Watch off-by-one errors.", gradedById: lecturerId } });

  const counts = await Promise.all([db.institution.count(), db.offer.count(), db.user.count()]);
  console.log(`Seeded: ${counts[0]} institutions, ${counts[1]} offers, ${counts[2]} users (password: ${DEV_PASSWORD})`);
}

main().finally(() => db.$disconnect());

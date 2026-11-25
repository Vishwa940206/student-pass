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

  // ── Institution OS demo: programmes, counsellors, enquiries, applications (Inspire College) ──
  await db.lead.deleteMany({ where: { institutionId: ic } });
  await db.programme.deleteMany({ where: { institutionId: ic } });
  const progs = await Promise.all([
    ["BSc (Hons) Computing", "FULL_TIME", 36, 95_000_000],
    ["BSc (Hons) Business Management", "FULL_TIME", 36, 85_000_000],
    ["Foundation in Health Sciences", "FULL_TIME", 12, 45_000_000],
    ["Diploma in Content Creation", "PART_TIME", 12, 30_000_000],
  ].map(([name, mode, durationMonths, feeCents]) => db.programme.create({
    data: { institutionId: ic, name: name as string, mode: mode as "FULL_TIME" | "PART_TIME", durationMonths: durationMonths as number, feeCents: feeCents as number, intakes: ["Jan 2027", "May 2027"] },
  })));
  const counsellorIds: string[] = [];
  for (const [email, name] of [["rashmi@inspire-college.example", "Rashmi Wickramasinghe"], ["kevin@inspire-college.example", "Kevin de Silva"]]) {
    const u = await db.user.upsert({ where: { email }, update: { passwordHash, role: "INSTITUTION_STAFF" }, create: { email, name, passwordHash, role: "INSTITUTION_STAFF" } });
    await db.institutionStaff.upsert({ where: { userId: u.id }, update: { institutionId: ic, staffRole: "COUNSELLOR" }, create: { userId: u.id, institutionId: ic, staffRole: "COUNSELLOR" } });
    counsellorIds.push(u.id);
  }
  // Deterministic pseudo-random so the demo looks the same on every seed.
  let seed = 42;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
  const FIRST = ["Sahan", "Dinithi", "Kavindu", "Tharushi", "Ravindu", "Sachini", "Nimesh", "Hiruni", "Pasindu", "Imasha", "Chamod", "Senuri", "Yasiru", "Malsha", "Dulaj", "Ishini"];
  const LAST = ["Perera", "Fernando", "Silva", "Jayawardena", "Bandara", "Herath", "Rathnayake", "Gunasekara", "Wijesinghe", "Dissanayake"];
  const SOURCES = ["WEBSITE", "WEBSITE", "INSTAGRAM", "WHATSAPP", "WALK_IN", "REFERRAL", "STUDENT_PASS", "EVENT", "FACEBOOK"] as const;
  const DISTRICTS = ["Colombo", "Colombo", "Gampaha", "Kandy", "Kalutara", "Galle", "Kurunegala", "Matara", "Jaffna"];
  const STAGES = ["NEW", "CONTACTED", "COUNSELLING", "APPLIED", "OFFER", "ENROLLED"] as const;
  for (let i = 0; i < 64; i++) {
    const source = pick(SOURCES);
    const boost = source === "REFERRAL" ? 0.25 : source === "STUDENT_PASS" ? 0.2 : source === "INSTAGRAM" ? -0.1 : 0;
    const x = rnd() + boost;
    const prog = rnd() < 0.85 ? pick(progs) : null;
    const reached = x > 0.97 ? 5 : x > 0.88 ? 4 : x > 0.72 ? 3 : x > 0.5 ? 2 : x > 0.25 ? 1 : 0;
    const si = prog ? reached : Math.min(reached, 2); // applying needs a programme
    const ageDays = Math.floor(rnd() * 170) + (si === 0 ? 0 : 3);
    const created = new Date(Date.now() - ageDays * 86_400_000);
    const lost = si < 3 && rnd() < 0.15;
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const lead = await db.lead.create({
      data: {
        institutionId: ic, name, phone: `+94 7${Math.floor(rnd() * 8)} ${100 + Math.floor(rnd() * 899)} ${1000 + Math.floor(rnd() * 8999)}`,
        district: pick(DISTRICTS), source, programmeId: prog?.id ?? null, stage: STAGES[si],
        counsellorId: i % 9 === 0 ? null : counsellorIds[i % 2], consent: true, createdAt: created,
        lastActivityAt: new Date(created.getTime() + Math.min(ageDays, Math.floor(rnd() * 10)) * 86_400_000),
        lostAt: lost ? new Date() : null, lostReason: lost ? pick(["Chose another institution", "Fees too high", "No response"]) : null,
      },
    });
    await db.leadActivity.create({ data: { leadId: lead.id, kind: "SYSTEM", body: source === "WEBSITE" ? "Enquiry from the website" : "Added by counsellor", createdAt: created } });
    if (si >= 1) await db.leadActivity.create({ data: { leadId: lead.id, kind: pick(["CALL", "WHATSAPP"] as const), body: "Discussed entry requirements and intakes.", authorId: counsellorIds[i % 2], createdAt: new Date(created.getTime() + 86_400_000) } });
    if (si >= 3 && prog) { // always true when si >= 3
      const status = si === 5 ? "ENROLLED" : si === 4 ? pick(["OFFER_ISSUED", "ACCEPTED", "DEPOSIT_PAID"] as const) : "UNDER_REVIEW";
      await db.application.create({ data: { institutionId: ic, leadId: lead.id, programmeId: prog.id, intake: pick(prog.intakes), status, createdAt: new Date(created.getTime() + 5 * 86_400_000), statusAt: new Date(created.getTime() + 9 * 86_400_000) } });
    }
  }
  await db.institution.update({
    where: { id: ic },
    data: { displayName: "Inspire College", tagline: "Learn by building.", brandColor: "#7C5CFF", logo: null, logoType: null, payhereMerchantId: null, payhereSecretEnc: null, payhereSandbox: true },
  });

  // ── Phase 2/3 demo: LMS content + attendance, knowledge, invoices, proposal (Inspire College) ──
  const weeks = [
    ["Week 1 · Getting started", [["Welcome and course map", "What we’ll build this term and how you’ll be assessed."], ["Tools you’ll need", "Install VS Code and Node.js.", "https://code.visualstudio.com/"]]],
    ["Week 2 · Core ideas", [["Variables and types", "Numbers, strings and booleans, with short exercises."], ["Loops", "for and while loops, with a practice set."]]],
  ] as const;
  for (const [wi, [title, lessons]] of weeks.entries()) {
    await db.courseModule.create({
      data: { courseId: cs.id, title, position: wi, lessons: { create: lessons.map((l, li) => ({ title: l[0], body: l[1], url: l[2] ?? null, position: li })) } },
    });
  }
  const firstLesson = await db.lesson.findFirstOrThrow({ where: { module: { courseId: cs.id } }, orderBy: { position: "asc" } });
  await db.lessonProgress.create({ data: { lessonId: firstLesson.id, studentId: nethmi.id } });
  for (const [i, status] of (["PRESENT", "PRESENT", "LATE", "ABSENT", "PRESENT"] as const).entries()) {
    await db.attendanceSession.create({ data: { courseId: cs.id, title: `Lecture ${i + 1}`, date: day(-14 + i * 3, 9), createdById: lecturerId, records: { create: [{ studentId: nethmi.id, status }] } } });
  }
  await db.submission.create({ data: { assignmentId: a1.id, studentId: nethmi.id, text: "Lab answers attached.", link: "https://example.com/lab1" } });

  await db.knowledgeEntry.deleteMany({ where: { institutionId: ic } });
  await db.knowledgeEntry.createMany({ data: [
    { institutionId: ic, title: "Intakes and deadlines", source: "Academic calendar", body: "We take students in January and May. Applications for January 2027 close on 15 December 2026; late applications are reviewed if places remain." },
    { institutionId: ic, title: "Fees and instalments", source: "Fee schedule 2026/27", body: "BSc (Hons) Computing is LKR 950,000 a year, payable in three instalments. An acceptance deposit of LKR 50,000 secures your place and counts towards the first instalment." },
    { institutionId: ic, title: "Entry requirements", source: "Admissions policy", body: "Degree programmes need three A/L passes. If you don’t meet that yet, the one-year Foundation route leads into year 1." },
    { institutionId: ic, title: "Scholarships", source: "Scholarship policy", body: "Merit scholarships of up to 50% are available for strong A/L results. Apply after you receive an offer; a panel decides each case." },
  ] });

  await db.invoice.deleteMany({ where: { institutionId: ic } });
  await db.invoice.createMany({ data: [
    { institutionId: ic, studentId: nethmi.id, number: "INV-00001", item: "Tuition instalment 1", amountCents: 316_667_00, dueDate: day(-20, 23), status: "PAID", paidAt: day(-22), createdById: registrarId },
    { institutionId: ic, studentId: nethmi.id, number: "INV-00002", item: "Tuition instalment 2", amountCents: 316_667_00, dueDate: day(10, 23), createdById: registrarId },
    { institutionId: ic, studentId: nethmi.id, number: "INV-00003", item: "Lab materials", amountCents: 7_500_00, dueDate: day(-3, 23), createdById: registrarId },
  ] });
  const paid = await db.invoice.findFirstOrThrow({ where: { institutionId: ic, number: "INV-00001" } });
  await db.payment.create({ data: { invoiceId: paid.id, amountCents: paid.amountCents, method: "BANK_TRANSFER", status: "SUCCEEDED", reference: "BOC-778812", recordedById: registrarId } });
  await db.proposalRequest.deleteMany({ where: { institutionId: ic } });
  await db.proposalRequest.create({ data: { institutionId: ic, institutionName: "Inspire College", contactName: "Dilani Jayasuriya", email: "registrar@inspire-college.example", items: ["ai", "kb", "camp"], studentsBand: "500–2,000", notes: "Interested in the assistant for the January intake." } });

  const counts = await Promise.all([db.institution.count(), db.offer.count(), db.user.count()]);
  console.log(`Seeded: ${counts[0]} institutions, ${counts[1]} offers, ${counts[2]} users (password: ${DEV_PASSWORD})`);
}

main().finally(() => db.$disconnect());

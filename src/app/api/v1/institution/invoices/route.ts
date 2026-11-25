import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";
import { displayStatus, invoiceSelect } from "@/lib/os/fees";
import type { Prisma } from "@/generated/prisma/client";

/** Invoices. status: due | overdue | paid | void | all (default all); q: student name/number, invoice no. or item */
export const GET = handler(async (req) => {
  const { institutionId } = await requireStaff("ADMIN");
  await requireModule(institutionId, "fees");
  const p = new URL(req.url).searchParams;
  const where: Prisma.InvoiceWhereInput = { institutionId };
  const s = p.get("status");
  if (s === "due") where.status = "DUE";
  if (s === "overdue") Object.assign(where, { status: "DUE", dueDate: { lt: new Date() } });
  if (s === "paid") where.status = "PAID";
  if (s === "void") where.status = "VOID";
  const q = p.get("q")?.trim();
  if (q) where.OR = [
    { number: { contains: q, mode: "insensitive" } },
    { item: { contains: q, mode: "insensitive" } },
    { student: { studentNumber: { contains: q, mode: "insensitive" } } },
    { student: { user: { name: { contains: q, mode: "insensitive" } } } },
  ];
  const [invoices, totals] = await Promise.all([
    db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 500, select: invoiceSelect }),
    db.invoice.groupBy({ by: ["status"], where: { institutionId }, _sum: { amountCents: true }, _count: true }),
  ]);
  const overdue = await db.invoice.aggregate({ where: { institutionId, status: "DUE", dueDate: { lt: new Date() } }, _sum: { amountCents: true }, _count: true });
  const sum = (st: string) => totals.find((t) => t.status === st);
  return json({
    summary: {
      dueCents: sum("DUE")?._sum.amountCents ?? 0, dueCount: sum("DUE")?._count ?? 0,
      overdueCents: overdue._sum.amountCents ?? 0, overdueCount: overdue._count,
      paidCents: sum("PAID")?._sum.amountCents ?? 0, paidCount: sum("PAID")?._count ?? 0,
    },
    invoices: invoices.map((i) => ({ ...i, display: displayStatus(i) })),
  });
});

const Input = z.object({
  studentNumbers: z.array(z.string().trim().min(1).max(40)).min(1).max(1000),
  item: z.string().trim().min(2).max(160),
  amountCents: z.int().min(100).max(1_000_000_000_00),
  dueDate: z.iso.date(),
});

/** Bill one or many students (by student number). Numbers are sequential per institution. */
export const POST = handler(async (req) => {
  const { user, institutionId } = await requireStaff("ADMIN");
  await requireModule(institutionId, "fees");
  const input = await body(req, Input);
  const wanted = [...new Set(input.studentNumbers)];
  const students = await db.studentProfile.findMany({ where: { institutionId, studentNumber: { in: wanted } }, select: { id: true, studentNumber: true } });
  if (!students.length) throw new ApiError(404, "NO_MATCH", "None of those student numbers belong to your institution");
  const due = new Date(`${input.dueDate}T18:29:59Z`); // end of day, Colombo

  const created = await db.$transaction(async (tx) => {
    // Serialise numbering per institution so concurrent billing can't collide.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"invoice:" + institutionId}))`;
    const last = await tx.invoice.findFirst({ where: { institutionId }, orderBy: { number: "desc" }, select: { number: true } });
    let n = last ? Number(last.number.replace(/\D/g, "")) || 0 : 0; // INV-00042 → 42 (zero-padded, so text order = number order)
    await tx.invoice.createMany({
      data: students.map((s) => ({
        institutionId, studentId: s.id, number: `INV-${String(++n).padStart(5, "0")}`,
        item: input.item, amountCents: input.amountCents, dueDate: due, createdById: user.id,
      })),
    });
    return students.length;
  });
  const matched = new Set(students.map((s) => s.studentNumber));
  return json({ created, notFound: wanted.filter((x) => !matched.has(x)) }, 201);
});

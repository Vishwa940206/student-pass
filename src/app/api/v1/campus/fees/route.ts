import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import { requireCampusStudent } from "@/lib/campus/access";
import { displayStatus } from "@/lib/os/fees";

/** The signed-in student's invoices, and whether they can pay online. */
export const GET = handler(async () => {
  const { studentId, institutionId } = await requireCampusStudent();
  const [inst, invoices] = await Promise.all([
    db.institution.findUniqueOrThrow({ where: { id: institutionId }, select: { modules: true, payhereMerchantId: true, payhereSecretEnc: true } }),
    db.invoice.findMany({
      where: { studentId, institutionId, status: { not: "VOID" } }, orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      select: { id: true, number: true, item: true, amountCents: true, dueDate: true, status: true, paidAt: true,
        payments: { where: { status: "SUCCEEDED" }, select: { method: true, reference: true, createdAt: true } } },
    }),
  ]);
  return json({
    enabled: inst.modules.includes("fees"),
    payOnline: inst.modules.includes("payments") && Boolean(inst.payhereMerchantId && inst.payhereSecretEnc),
    invoices: invoices.map((i) => ({ ...i, display: displayStatus(i) })),
  });
});

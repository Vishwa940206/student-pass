import "server-only";

/** Display status: DUE past its due date shows as OVERDUE. */
export const displayStatus = (i: { status: string; dueDate: Date }) =>
  i.status === "DUE" && i.dueDate < new Date() ? "OVERDUE" : i.status;

export const invoiceSelect = {
  id: true, number: true, item: true, amountCents: true, dueDate: true, status: true, paidAt: true, createdAt: true,
  student: { select: { id: true, studentNumber: true, user: { select: { name: true, email: true } } } },
  payments: { orderBy: { createdAt: "desc" as const }, select: { id: true, amountCents: true, method: true, status: true, reference: true, createdAt: true } },
} as const;

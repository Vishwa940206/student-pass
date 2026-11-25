import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, body, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";
import { requireModule } from "@/lib/os/entitlements";

const Input = z.object({ method: z.enum(["CASH", "BANK_TRANSFER", "OTHER"]), reference: z.string().trim().max(120).nullish() });

/** Record a payment taken outside the gateway (cash, bank transfer). Pays the invoice in full. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/institution/invoices/[id]/payments">) => {
  const { user, institutionId } = await requireStaff("ADMIN");
  await requireModule(institutionId, "fees");
  const { id } = await ctx.params;
  const input = await body(req, Input);
  await db.$transaction(async (tx) => {
    const [inv] = await tx.$queryRaw<{ status: string; amountCents: number }[]>`
      SELECT status, "amountCents" FROM "Invoice" WHERE id = ${id} AND "institutionId" = ${institutionId} FOR UPDATE`;
    found(inv, "Invoice");
    if (inv.status !== "DUE") throw new ApiError(409, "NOT_DUE", inv.status === "PAID" ? "This invoice is already paid" : "This invoice is void");
    await tx.payment.create({ data: { invoiceId: id, amountCents: inv.amountCents, method: input.method, status: "SUCCEEDED", reference: input.reference || null, recordedById: user.id } });
    await tx.invoice.update({ where: { id }, data: { status: "PAID", paidAt: new Date() } });
  });
  return json({ ok: true }, 201);
});

import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireStaff } from "@/lib/campus/access";

/** Cancel an unpaid invoice (kept for the record). */
export const POST = handler(async (_req, ctx: RouteContext<"/api/v1/institution/invoices/[id]/void">) => {
  const { institutionId } = await requireStaff("ADMIN");
  const { id } = await ctx.params;
  const inv = found(await db.invoice.findFirst({ where: { id, institutionId }, select: { status: true } }), "Invoice");
  if (inv.status !== "DUE") throw new ApiError(409, "NOT_DUE", "Only unpaid invoices can be voided");
  const { count } = await db.invoice.updateMany({ where: { id, status: "DUE" }, data: { status: "VOID" } });
  if (!count) throw new ApiError(409, "NOT_DUE", "This invoice changed. Refresh and try again");
  return json({ ok: true });
});

import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { ApiError, handler, json } from "@/lib/api";
import { found, requireCampusStudent } from "@/lib/campus/access";

/** Create (or return) a family pay link for one of your unpaid invoices. */
export const POST = handler(async (req, ctx: RouteContext<"/api/v1/campus/invoices/[id]/share">) => {
  const { studentId, institutionId } = await requireCampusStudent();
  const { id } = await ctx.params;
  const inv = found(await db.invoice.findFirst({ where: { id, studentId, institutionId }, select: { status: true, payToken: true } }), "Invoice");
  if (inv.status !== "DUE") throw new ApiError(409, "NOT_DUE", "Only unpaid invoices can be shared");
  const token = inv.payToken ?? randomBytes(18).toString("base64url");
  if (!inv.payToken) await db.invoice.update({ where: { id }, data: { payToken: token } });
  return json({ url: `${new URL(req.url).origin}/pay/${token}` });
});

/** Stop sharing: the old link stops working. */
export const DELETE = handler(async (_req, ctx: RouteContext<"/api/v1/campus/invoices/[id]/share">) => {
  const { studentId } = await requireCampusStudent();
  const { id } = await ctx.params;
  const { count } = await db.invoice.updateMany({ where: { id, studentId }, data: { payToken: null } });
  found(count || null, "Invoice");
  return json({ ok: true });
});

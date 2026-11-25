import { z } from "zod";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { found } from "@/lib/campus/access";
import { db } from "@/lib/db";
import { createMerchantStaff } from "@/lib/merchants";

export const POST = handler(async (req, ctx: RouteContext<"/api/v1/admin/merchants/[id]/staff">) => {
  await requireUser("ADMIN");
  const { id } = await ctx.params;
  found(await db.merchant.findUnique({ where: { id }, select: { id: true } }), "Merchant");
  const { name, email } = await body(req, z.object({ name: z.string().trim().min(2).max(80), email: z.email().trim().toLowerCase() }));
  return json(await createMerchantStaff(id, name, email), 201);
});

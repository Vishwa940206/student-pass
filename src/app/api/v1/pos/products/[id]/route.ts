import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { found } from "@/lib/campus/access";
import { requireStaff } from "@/lib/pos/staff";
import { SHOP_CATEGORIES } from "@/lib/shop";

const Patch = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  category: z.enum(SHOP_CATEGORIES).optional(),
  subtitle: z.string().trim().max(160).optional(),
  description: z.string().trim().max(4000).optional(),
  art: z.string().trim().max(8).optional(),
  priceCents: z.int().min(100).max(100_000_000_00).optional(),
  rrpCents: z.int().min(100).max(100_000_000_00).nullish(),
  stock: z.int().min(0).max(1_000_000).nullish(),
  active: z.boolean().optional(),
});

export const PATCH = handler(async (req, ctx: RouteContext<"/api/v1/pos/products/[id]">) => {
  const { merchantId } = await requireStaff();
  const { id } = await ctx.params;
  const p = await body(req, Patch);
  const { count } = await db.product.updateMany({ where: { id, merchantId }, data: p });
  found(count || null, "Product");
  return json({ ok: true });
});

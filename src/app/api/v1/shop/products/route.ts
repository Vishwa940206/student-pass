import { db } from "@/lib/db";
import { handler, json } from "@/lib/api";
import type { Prisma } from "@/generated/prisma/client";

/** Public catalogue: active products at student prices. Filters: category, q, merchant. */
export const GET = handler(async (req) => {
  const p = new URL(req.url).searchParams;
  const where: Prisma.ProductWhereInput = { active: true };
  if (p.get("category")) where.category = p.get("category")!;
  if (p.get("merchant")) where.merchantId = p.get("merchant")!;
  const q = p.get("q")?.trim();
  if (q) where.OR = [{ title: { contains: q, mode: "insensitive" } }, { subtitle: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }, { merchant: { name: { contains: q, mode: "insensitive" } } }];
  const products = await db.product.findMany({
    where, orderBy: [{ createdAt: "desc" }], take: 300,
    select: { id: true, title: true, category: true, subtitle: true, description: true, art: true, priceCents: true, rrpCents: true, stock: true, merchant: { select: { id: true, name: true, locations: { where: { inProgramme: true }, select: { name: true, district: true } } } } },
  });
  return json({ products });
});

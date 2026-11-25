import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireStaff } from "@/lib/pos/staff";
import { SHOP_CATEGORIES } from "@/lib/shop";

export const GET = handler(async () => {
  const { merchantId } = await requireStaff();
  const products = await db.product.findMany({
    where: { merchantId }, orderBy: { createdAt: "desc" },
    include: { _count: { select: { reservations: { where: { status: "RESERVED" } } } } },
  });
  return json({ products: products.map(({ _count, ...p }) => ({ ...p, openReservations: _count.reservations })), categories: SHOP_CATEGORIES });
});

export const ProductInput = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.enum(SHOP_CATEGORIES),
  subtitle: z.string().trim().max(160).default(""),
  description: z.string().trim().max(4000).default(""),
  art: z.string().trim().max(8).default(""),
  priceCents: z.int().min(100).max(100_000_000_00),
  rrpCents: z.int().min(100).max(100_000_000_00).nullish(),
  stock: z.int().min(0).max(1_000_000).nullish(),
  active: z.boolean().default(true),
}).refine((p) => p.rrpCents == null || p.rrpCents >= p.priceCents, { message: "The usual price must be at least the student price", path: ["rrpCents"] });

export const POST = handler(async (req) => {
  const { merchantId } = await requireStaff();
  const p = await body(req, ProductInput);
  return json(await db.product.create({ data: { ...p, rrpCents: p.rrpCents ?? null, stock: p.stock ?? null, merchantId }, select: { id: true } }), 201);
});

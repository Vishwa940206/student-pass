import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { body, handler, json } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createMerchantStaff, slugify } from "@/lib/merchants";

export const GET = handler(async () => {
  await requireUser("ADMIN");
  const merchants = await db.merchant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, createdAt: true,
      locations: { orderBy: { code: "asc" }, select: { id: true, code: true, name: true, district: true, inProgramme: true } },
      staff: { select: { user: { select: { name: true, email: true } } } },
      _count: { select: { products: true, offers: true } } },
  });
  return json({ merchants: merchants.map(({ _count, staff, ...m }) => ({ ...m, staff: staff.map((s) => s.user), products: _count.products, offers: _count.offers })) });
});

export const Branch = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Branch codes are 2–6 letters or digits"),
  name: z.string().trim().min(2).max(80),
  district: z.string().trim().min(2).max(40),
  inProgramme: z.boolean().default(true),
});

const Input = z.object({
  name: z.string().trim().min(2).max(120),
  branches: z.array(Branch).min(1).max(50),
  staff: z.object({ name: z.string().trim().min(2).max(80), email: z.email().trim().toLowerCase() }),
});

/** Onboard a merchant: branches + the first staff login (one-time password shown once). */
export const POST = handler(async (req) => {
  await requireUser("ADMIN");
  const input = await body(req, Input);
  const codes = input.branches.map((b) => b.code);
  if (new Set(codes).size !== codes.length) return json({ error: { code: "DUPLICATE", message: "Branch codes must be different" } }, 400);
  const m = await db.merchant.create({
    data: { name: input.name, slug: `${slugify(input.name)}-${randomBytes(2).toString("hex")}`, locations: { create: input.branches } },
    select: { id: true },
  });
  const login = await createMerchantStaff(m.id, input.staff.name, input.staff.email).catch(async (e) => {
    await db.merchant.delete({ where: { id: m.id } }); // don't leave a merchant without a login
    throw e;
  });
  return json({ id: m.id, ...login }, 201);
});

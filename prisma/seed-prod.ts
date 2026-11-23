/*
 * Production seed — idempotent (safe to re-run).
 * Loads real reference data only: institutions and the browse-only (PROSPECT) catalogue.
 * No demo students, no sandbox merchant, no shared passwords.
 *
 * Optionally creates or promotes one admin:
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='…' pnpm db:seed:prod
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { TYPE, INSTS, CATALOGUE, slugify } from "./seed-data";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function main() {
  for (const [name, shortName, district, type] of INSTS) {
    const slug = slugify(shortName);
    const row = { name, shortName, district, type: TYPE[type], isPartner: shortName === "IC" };
    await db.institution.upsert({ where: { slug }, update: row, create: { slug, ...row } });
  }

  for (const o of CATALOGUE) {
    await db.offer.upsert({ where: { slug: o.slug }, update: { ...o, status: "PROSPECT" }, create: { ...o, status: "PROSPECT" } });
  }

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (email) {
    const password = process.env.ADMIN_PASSWORD ?? "";
    if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
    const passwordHash = await hashPassword(password);
    const name = process.env.ADMIN_NAME?.trim() || "Student Pass Admin";
    await db.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN" },
      create: { email, name, passwordHash, role: "ADMIN" },
    });
    console.log(`Admin ready: ${email}`);
  }

  const counts = await Promise.all([db.institution.count(), db.offer.count(), db.user.count({ where: { role: "ADMIN" } })]);
  console.log(`Production seed: ${counts[0]} institutions, ${counts[1]} offers, ${counts[2]} admin(s)`);
}

main().finally(() => db.$disconnect());

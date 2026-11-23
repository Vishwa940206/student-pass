import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrations) needs a direct/session connection. On Supabase that is
    // DIRECT_URL; the app itself uses the pooled DATABASE_URL. Locally both are the same.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});

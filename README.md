# Student Pass

Sri Lanka's student platform: a verified digital pass, student offers, and merchant scan-to-redeem.

The design reference is the single-file prototype (`student-pass.html`). This repo is the real product. **MVP scope:** Pass + Offers + merchant POS. The prototype's shop, pay, loans, pathways, campus life and Institution OS come later.

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL · Prisma 7 (`@prisma/adapter-pg`) · Zod · Vitest

## Screens

| Path | Who | What |
|---|---|---|
| `/` | everyone | Home |
| `/offers` | everyone | Search, category, channel, district and saved filters; offer details |
| `/signup`, `/login` | students | Institution picker; new accounts start as *pending* |
| `/pass` | students | Live rotating QR (30 s ring), full-screen scan, freeze, card colour, sponsored perks, savings |
| `/pos` | merchant staff | Branch, bill amount, scan (camera via BarcodeDetector) or paste QR, apply / complete / cancel, ledger with refunds |
| `/admin` | admins | Verification queue |

The UI reuses the prototype's stylesheet unchanged (`src/styles/prototype.css`) and its icon sprite (`src/components/Sprite.tsx`). Pages are static shells, and interactive parts call `/api/v1` from the browser, the same API the mobile apps will use.

**Try the whole flow:** sign in as `nethmi@example.com` in one browser window and open My Pass. In a private window, sign in as `cashier@sandbox-cafe.example`. In development, **Copy code** on the pass copies the live QR content so you can paste it into the POS.

## Getting started

```bash
pnpm install
cp .env.example .env          # then fill PASS_TOKEN_SECRET (openssl rand -base64 48)
pnpm db:up                    # terminal 1: local Postgres 18 on :54329 (no Docker needed)
pnpm db:migrate               # apply migrations
pnpm db:seed                  # institutions, offers, demo accounts
pnpm dev                      # terminal 2: http://localhost:3000
```

For local dev, set `DATABASE_URL="postgresql://postgres:postgres@localhost:54329/student_pass"`.

> Don't use `prisma dev` (PGlite) for this project. It can't run concurrent transactions, and the POS relies on row locks (`SELECT … FOR UPDATE`).

### Demo accounts (password `studentpass`)

| Email | Role | State |
|---|---|---|
| nethmi@example.com | Student · Inspire College | Verified (eligible for the sponsored weekly coffee) |
| kasun@example.com | Student · University of Moratuwa | Verified |
| ishara@example.com | Student · SLIIT | Verified, pass **frozen** |
| amaya@example.com | Student · University of Colombo | **Pending** verification |
| cashier@sandbox-cafe.example | Merchant staff · Sandbox Café | — |
| admin@studentpass.example | Admin | — |

"Sandbox Café" is a fictional merchant for testing. The real-brand categories from the prototype are seeded as `PROSPECT`: browsable, but not redeemable until their terms are confirmed.

## Using Supabase (hosted Postgres)

Supabase is used **as the PostgreSQL database only**. Auth, sessions and the API stay in this app. No code changes are needed, only configuration:

1. Create a project at supabase.com. Mumbai (`ap-south-1`) is the closest region to Sri Lanka. Save the database password.
2. **Project Settings → Database → SSL Configuration → Download certificate.** Save it as `prisma/certs/supabase-ca.crt` (it's a public certificate, safe to commit).
3. In `.env`, set `DATABASE_URL` (transaction pooler, port 6543) and `DIRECT_URL` (session pooler, port 5432) from **Connect**, using the format in `.env.example`.
4. Create the tables, then load the seed data:
   ```bash
   pnpm exec prisma migrate deploy
   pnpm db:seed          # dev/demo data only; skip for production
   ```

Notes:
- Keep `sslmode=verify-full&sslrootcert=…`. Plain `sslmode=require` fails with "self-signed certificate", because Supabase uses its own CA.
- **Row Level Security** is enabled on every table (migration `enable_row_level_security`). With no policies, Supabase's public Data API can't read anything, while the app (connecting as the table owner) works normally. **Every new table needs `ENABLE ROW LEVEL SECURITY` in its migration.**
- The POS relies on transactions and row locks, which work through the transaction pooler (6543).

## Deploying (Vercel + Supabase)

1. Set up Supabase as above. Commit `prisma/certs/supabase-ca.crt` (it's public, and `next.config.ts` bundles it with the server functions).
2. From your machine, with `DATABASE_URL` and `DIRECT_URL` pointing at Supabase:
   ```bash
   pnpm db:deploy                                   # apply migrations
   ADMIN_EMAIL=you@example.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='<12+ chars>' pnpm db:seed:prod
   ```
   `db:seed:prod` loads institutions and the browse-only catalogue, and creates or promotes that one admin. It is safe to re-run. **Never run `pnpm db:seed` against production**: it creates demo accounts with the shared password `studentpass`.
3. Import the GitHub repo in Vercel (framework: Next.js, detected automatically). Set these environment variables for Production:
   - `DATABASE_URL`: transaction pooler (6543), with `sslmode=verify-full&sslrootcert=prisma/certs/supabase-ca.crt`
   - `PASS_TOKEN_SECRET`: a **new** value from `openssl rand -base64 48`, not your local one
   - Leave `DIRECT_URL` out of Vercel. Only the Prisma CLI uses it.
4. Deploy. Pushes to `main` redeploy automatically. Run `pnpm db:deploy` from your machine **before** merging anything that adds a migration.
5. `vercel.json` pins the server functions to Mumbai (`bom1`), next to the database.


```bash
pnpm test     # unit tests: pass tokens, discount/eligibility rules, Colombo week boundaries
pnpm smoke    # end-to-end API scenarios against a running dev server (API=http://localhost:3000/api/v1 pnpm smoke)
```

## How the pass works

- The QR content is `SP1.<passId>.<step>.<hmac>`. `passId` is opaque: it carries no name, institution or balance. `step` is the 30-second window. The HMAC uses the server-only `PASS_TOKEN_SECRET`.
- Tokens are accepted for the current and previous window, so a screenshot stops working within about a minute.
- Each token window can be used **once** (`Authorization @@unique([studentId, tokenStep])`).

## POS flow (authorise → capture)

```
POST /api/v1/pos/scan                              dry run: who is this + which offers apply
POST /api/v1/pos/authorizations   Idempotency-Key  reserve the discount (5-min hold)
POST /api/v1/pos/authorizations/:id/capture        complete the sale → Redemption (receipt ref)
POST /api/v1/pos/authorizations/:id/cancel         basket changed / abandoned
POST /api/v1/pos/redemptions/:id/void              refund; gives the allowance back
GET  /api/v1/pos/redemptions                       reconciliation ledger
```

- **Retries are safe.** The same `Idempotency-Key` returns the same hold, and capturing twice returns the same receipt.
- **Concurrency.** The student row is locked during authorisation, so two branches scanning at once can't both spend one weekly allowance. Sponsor budgets are decremented atomically.
- **Rules** live in `src/lib/pos/rules.ts` (pure, unit-tested): frozen pass, verification and expiry, offer status and dates, branch in programme, institution-only offers, minimum spend, weekly and yearly limits (Asia/Colombo, week resets Monday 00:00), and sponsor budget.

## Other endpoints

```
POST /api/v1/auth/signup | login | logout      GET /api/v1/me
GET  /api/v1/institutions                      GET /api/v1/offers?q&category&channel&district&saved=1
PUT|DELETE /api/v1/offers/:id/save             GET /api/v1/pass/token     POST /api/v1/pass/freeze
GET  /api/v1/admin/verifications               POST /api/v1/admin/verifications/:id
```

Mutating requests must be JSON and same-origin. Sessions are httpOnly, SameSite=Lax cookies, and only a SHA-256 of each token is stored.

## Layout

```
prisma/schema.prisma        data model (money = integer LKR cents)
prisma/seed.ts              idempotent dev seed
src/lib/pass-token.ts       rotating QR tokens
src/lib/pos/rules.ts        eligibility + discount rules (pure)
src/lib/pos/service.ts      authorise / capture / cancel / void (transactions)
src/lib/auth/               scrypt passwords, DB sessions
src/app/api/v1/             route handlers
scripts/db.mjs              local Postgres
scripts/smoke.sh            API scenarios
```

## Next up

1. Real student verification (institution roster / document upload) to replace the manual admin approval.
2. Rate limiting on login and signup, email verification, password reset.
3. Language switch (EN / සිං / தமிழ்), as in the prototype.
4. Merchant and offer management in the admin UI (production starts with browse-only offers).

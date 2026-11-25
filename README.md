# Student Pass

Sri Lanka's student platform: a verified digital pass, student offers, and merchant scan-to-redeem.

The design reference is the single-file prototype (`student-pass.html`). This repo is the real product. **Live:** Pass, Offers, merchant POS, Campus Life and the institution portal. The prototype's shop, pay, loans, points and pathways are interactive previews at `/preview` (see below).

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
| `/campus` | verified students | Campus Life: due-soon deadlines, courses with assignments and grades, events (RSVP with capacity), clubs (join/leave), notices |
| `/institution` | institution staff | **Institution OS**: BI brain (KPIs + next best actions), analytics, market intelligence, CRM, admissions, student verification, notices, events, clubs, courses (enrolment, assignments, gradebook), staff, white-label settings and programmes. Tabs depend on the staff role |
| `/enquire/[slug]` | public | The institution's branded enquiry page. Submissions become CRM leads assigned to the least-busy counsellor |
| `/account` | everyone signed in | Change password (signs out other devices) |
| `/admin` | platform admins | Verification queue (all institutions); create each institution's first admin |

The UI reuses the prototype's stylesheet unchanged (`src/styles/prototype.css`) and its icon sprite (`src/components/Sprite.tsx`). Pages are static shells, and interactive parts call `/api/v1` from the browser, the same API the mobile apps will use.

**Try the whole flow:** sign in as `nethmi@example.com` in one browser window and open My Pass. In a private window, sign in as `cashier@sandbox-cafe.example`. In development, **Copy code** on the pass copies the live QR content so you can paste it into the POS.

## Getting started

```bash
pnpm install
cp .env.example .env          # then fill PASS_TOKEN_SECRET (openssl rand -base64 48)
pnpm db:up                    # terminal 1: local Postgres 18 on :54329 (no Docker needed)
pnpm db:deploy                # apply migrations
pnpm db:seed                  # institutions, offers, demo accounts
pnpm dev                      # terminal 2: http://localhost:3000
```

For local dev, set `DATABASE_URL="postgresql://postgres:postgres@localhost:54329/student_pass"`.

> `prisma migrate dev` can't replay migration `20261123100117_enable_row_level_security` on its shadow database (that migration enables RLS on `_prisma_migrations`, which doesn't exist there). Apply migrations with `pnpm db:deploy`, and generate new ones with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script`, adding `ENABLE ROW LEVEL SECURITY` for each new table.

> Don't use `prisma dev` (PGlite) for this project. It can't run concurrent transactions, and the POS relies on row locks (`SELECT … FOR UPDATE`).

### Demo accounts (password `studentpass`)

| Email | Role | State |
|---|---|---|
| nethmi@example.com | Student · Inspire College | Verified (eligible for the sponsored weekly coffee) |
| kasun@example.com | Student · University of Moratuwa | Verified |
| ishara@example.com | Student · SLIIT | Verified, pass **frozen** |
| amaya@example.com | Student · University of Colombo | **Pending** verification |
| cashier@sandbox-cafe.example | Merchant staff · Sandbox Café | — |
| admin@studentpass.example | Platform admin | — |
| registrar@inspire-college.example | Institution admin · Inspire College | Verifies students, manages staff |
| lecturer@inspire-college.example | Lecturer · Inspire College | Teaches CS101 and WEB201 |
| rashmi@inspire-college.example, kevin@inspire-college.example | Counsellors · Inspire College | ~60 sample enquiries and applications |

"Sandbox Café" is a fictional merchant for testing. The real-brand categories from the prototype are seeded as `PROSPECT`: browsable, but not redeemable until their terms are confirmed.

## Institutions and Campus Life

**Accounts.** A platform admin creates an institution's first admin at `/admin`. That person adds lecturers (or more admins) at `/institution` → Staff. New staff accounts get a one-time password, shown once to whoever created them. They change it at `/account`. Removing a staff member ends their sessions and portal access but keeps the account, so their notices and grades keep an author.

| | Lecturer | Counsellor | Institution admin |
|---|:-:|:-:|:-:|
| BI brain (actions for their own work) | ✓ | ✓ | ✓ |
| Notices, events, clubs, courses, assignments, grades | ✓ | | ✓ |
| CRM, admissions, analytics, market intelligence | | ✓ | ✓ |
| Verify the institution's students | | | ✓ |
| Staff, branding, programmes | | | ✓ |

**Institution OS.** Enquiries (`Lead`) move New → Contacted → Counselling, then via an `Application` through Under review → Offer issued → Accepted → Deposit paid → Enrolled. The lead's stage follows its application, and rejected or withdrawn applications mark the lead lost. Every change is written to the lead's timeline. Counsellors can reassign only their own leads. The BI brain's actions (uncontacted enquiries, stalled applications, waiting verifications, overdue grading, nearly full events) are computed from live records, filtered by role. Branding (display name, tagline, colour, logo as PNG/JPEG/WebP ≤ 256 KB, no SVG) appears on the portal, Campus Life, the enquiry page and the preview.

**Rate limiting** (`src/lib/rate-limit.ts`) uses Postgres counters shared by all serverless instances: login 30 per 15 min per IP and 10 per 15 min per email, signup 10 per hour per IP, enquiries 5 per hour per IP and 500 per day per institution, password changes 10 per 15 min per user. The enquiry form also has a honeypot field.

**Tenant isolation.** Every campus table has an `institutionId`. Handlers take it from `requireCampusStudent()` / `requireStaff()` in `src/lib/campus/access.ts`, never from the request, and include it in every query, so another institution's ids return 404. Students see Campus Life only once verified and while their pass is valid.

**Tests.** Against a server on a freshly seeded **dev** database: `scripts/smoke-campus.sh` (46 checks: access rules, isolation, RSVP capacity, grading, staff lifecycle) and `scripts/smoke-os.sh` (55 checks: roles, CRM/admissions flow, isolation, branding and logo validation, public enquiries, rate limits).

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
5. `vercel.json` pins the server functions to one region. Keep it matched to the Supabase region (`syd1` for `ap-southeast-2`, `bom1` for `ap-south-1`).


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

## Preview (coming-soon features)

`/preview` (route `src/app/preview/route.ts`) serves the full design prototype as an interactive preview, personalised with the signed-in person's name and institution, otherwise with sample data: shop, pay, loans, points, pathways, Campus Life, Institution OS and the merchant page. The home page and the desktop menu link into it. Nothing there touches the database.

Regenerate it after changing the prototype:

```bash
node scripts/build-preview.mjs ~/Downloads/student-pass.html
```

The script swaps real brands (Barista, the APIIT co-brand card, Adobe, GitHub, Microsoft 365) for neutral names, because the preview is public and those aren't partners yet. It fails if a known brand is left in. Add any new real brand to the script before publishing.

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

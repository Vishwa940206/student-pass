# Student Pass

Sri Lanka's student platform: a verified digital pass, student offers, and merchant scan-to-redeem.

The design reference is the single-file prototype (`student-pass.html`). This repo is the real product. **MVP scope:** Pass + Offers + merchant POS. The prototype's shop, pay, loans, pathways, campus life and Institution OS come later.

## Stack

Next.js 16 (App Router, TypeScript) · PostgreSQL · Prisma 7 (`@prisma/adapter-pg`) · Zod · Vitest

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

## Tests

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

1. Port the prototype's design system and build the UI pages: offers, My Pass (live QR), sign-up, and the POS screen.
2. Real student verification (institution roster / document upload) to replace the manual admin approval.
3. Rate limiting on login and signup, email verification, password reset.
4. Deploy: hosted Postgres + Vercel/Railway, with secrets in the host's secret store.

-- Lock down Supabase's auto-generated REST/GraphQL API (PostgREST).
--
-- Supabase exposes every table in the `public` schema through its Data API,
-- reachable with the public "anon" key. This app never uses that API: it
-- connects to Postgres directly as the table owner, which RLS does not restrict.
-- Enabling RLS with *no policies* therefore denies all Data API access
-- (users, password hashes, sessions…) while the app keeps working.
--
-- Harmless on plain PostgreSQL (local development).

ALTER TABLE "User"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Institution"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentProfile"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Merchant"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MerchantLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MerchantStaff"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Offer"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OfferLocation"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SavedOffer"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Authorization"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Redemption"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;

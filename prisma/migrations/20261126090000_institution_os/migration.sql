-- Institution OS phase 1: white-label branding, programmes, CRM leads + activity,
-- applications, the COUNSELLOR staff role, and shared rate-limit counters.

-- CreateEnum
CREATE TYPE "StudyMode" AS ENUM ('FULL_TIME', 'PART_TIME', 'ONLINE');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'STUDENT_PASS', 'INSTAGRAM', 'FACEBOOK', 'WHATSAPP', 'WALK_IN', 'PHONE', 'REFERRAL', 'EVENT', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'COUNSELLING', 'APPLIED', 'OFFER', 'ENROLLED');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('NOTE', 'CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'STAGE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('UNDER_REVIEW', 'OFFER_ISSUED', 'ACCEPTED', 'DEPOSIT_PAID', 'ENROLLED', 'REJECTED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "StaffRole" ADD VALUE 'COUNSELLOR';

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "brandColor" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "logo" BYTEA,
ADD COLUMN     "logoType" TEXT,
ADD COLUMN     "logoUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "tagline" TEXT;

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" "StudyMode" NOT NULL DEFAULT 'FULL_TIME',
    "durationMonths" INTEGER,
    "feeCents" INTEGER,
    "intakes" TEXT[],
    "open" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "district" TEXT,
    "source" "LeadSource" NOT NULL,
    "programmeId" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "counsellorId" TEXT,
    "consent" BOOLEAN NOT NULL DEFAULT false,
    "lostAt" TIMESTAMP(3),
    "lostReason" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "intake" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "statusAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Programme_institutionId_name_key" ON "Programme"("institutionId", "name");

-- CreateIndex
CREATE INDEX "Lead_institutionId_stage_idx" ON "Lead"("institutionId", "stage");

-- CreateIndex
CREATE INDEX "Lead_institutionId_createdAt_idx" ON "Lead"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_counsellorId_idx" ON "Lead"("counsellorId");

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_leadId_key" ON "Application"("leadId");

-- CreateIndex
CREATE INDEX "Application_institutionId_status_idx" ON "Application"("institutionId", "status");

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_counsellorId_fkey" FOREIGN KEY ("counsellorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No policies: Supabase's public Data API can't read these; the app (table owner) can.

ALTER TABLE "Programme"    ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Lead"         ENABLE ROW LEVEL SECURITY;

ALTER TABLE "LeadActivity" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "Application"  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "RateLimit"    ENABLE ROW LEVEL SECURITY;

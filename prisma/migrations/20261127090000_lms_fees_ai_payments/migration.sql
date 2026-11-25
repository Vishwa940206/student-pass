-- Institution OS phases 2 and 3: LMS content, progress, attendance and submissions;
-- invoices and payments (manual + PayHere); AI knowledge and conversations;
-- module entitlements; B2B proposal requests.

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DUE', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CARD_ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatChannel" AS ENUM ('PUBLIC', 'STUDENT');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('NEW', 'CONTACTED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Institution" ADD COLUMN     "modules" TEXT[] DEFAULT ARRAY['crm', 'admissions', 'analytics', 'market', 'lms', 'fees', 'ai', 'payments']::TEXT[],
ADD COLUMN     "payhereMerchantId" TEXT,
ADD COLUMN     "payhereSandbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payhereSecretEnc" TEXT;

-- CreateTable
CREATE TABLE "CourseModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lesson" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "lessonId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("lessonId","studentId")
);

-- CreateTable
CREATE TABLE "AttendanceSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("sessionId","studentId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "link" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("assignmentId","studentId")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reference" TEXT,
    "gatewayOrderId" TEXT,
    "gatewayStatus" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeEntry" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "source" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "channel" "ChatChannel" NOT NULL,
    "studentId" TEXT,
    "leadId" TEXT,
    "handedOver" BOOLEAN NOT NULL DEFAULT false,
    "answered" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sources" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "institutionName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "studentsBand" TEXT,
    "items" TEXT[],
    "notes" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseModule_courseId_position_idx" ON "CourseModule"("courseId", "position");

-- CreateIndex
CREATE INDEX "Lesson_moduleId_position_idx" ON "Lesson"("moduleId", "position");

-- CreateIndex
CREATE INDEX "AttendanceSession_courseId_date_idx" ON "AttendanceSession"("courseId", "date");

-- CreateIndex
CREATE INDEX "Invoice_institutionId_status_idx" ON "Invoice"("institutionId", "status");

-- CreateIndex
CREATE INDEX "Invoice_studentId_idx" ON "Invoice"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_institutionId_number_key" ON "Invoice"("institutionId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayOrderId_key" ON "Payment"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "KnowledgeEntry_institutionId_approved_idx" ON "KnowledgeEntry"("institutionId", "approved");

-- CreateIndex
CREATE INDEX "Conversation_institutionId_createdAt_idx" ON "Conversation"("institutionId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_conversationId_createdAt_idx" ON "ChatMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "CourseModule" ADD CONSTRAINT "CourseModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CourseModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonProgress" ADD CONSTRAINT "LessonProgress_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSession" ADD CONSTRAINT "AttendanceSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeEntry" ADD CONSTRAINT "KnowledgeEntry_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRequest" ADD CONSTRAINT "ProposalRequest_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- No policies: Supabase's public Data API can't read these; the app (table owner) can.
ALTER TABLE "CourseModule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lesson" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LessonProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Submission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProposalRequest" ENABLE ROW LEVEL SECURITY;

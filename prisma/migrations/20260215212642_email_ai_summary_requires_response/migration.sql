-- AlterTable
ALTER TABLE "EmailMessage" ADD COLUMN     "aiSummary" TEXT,
ADD COLUMN     "requiresResponse" BOOLEAN NOT NULL DEFAULT false;

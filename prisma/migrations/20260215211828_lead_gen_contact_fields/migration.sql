-- AlterTable
ALTER TABLE "LeadGenEntry" ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactInstagram" TEXT,
ADD COLUMN     "contactLinkedIn" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "contactStatus" TEXT DEFAULT 'not_reached',
ADD COLUMN     "isClosed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nextSteps" TEXT;

-- CreateIndex
CREATE INDEX "LeadGenEntry_userId_isClosed_idx" ON "LeadGenEntry"("userId", "isClosed");

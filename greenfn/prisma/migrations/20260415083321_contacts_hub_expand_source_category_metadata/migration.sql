-- CreateEnum
CREATE TYPE "ContactSourceCategory" AS ENUM ('REFERRAL', 'COLD_CALL', 'SOCIAL_MEDIA', 'EVENT', 'WEBSITE', 'OTHER');

-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "lifePriorities" TEXT,
ADD COLUMN     "policyMetadata" JSONB,
ADD COLUMN     "portfolioSummary" TEXT,
ADD COLUMN     "sourceCategory" "ContactSourceCategory";

-- CreateIndex
CREATE INDEX "Contact_fullName_idx" ON "Contact"("fullName");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_phone_idx" ON "Contact"("phone");

-- CreateIndex
CREATE INDEX "Contact_source_idx" ON "Contact"("source");

-- CreateIndex
CREATE INDEX "Contact_sourceCategory_idx" ON "Contact"("sourceCategory");

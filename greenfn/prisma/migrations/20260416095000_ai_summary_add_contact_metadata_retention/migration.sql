-- Expand: link AiSummary to Contact and add metadata/retention fields.
ALTER TABLE "AiSummary"
ADD COLUMN IF NOT EXISTS "contactId" TEXT,
ADD COLUMN IF NOT EXISTS "inputMode" TEXT,
ADD COLUMN IF NOT EXISTS "modelMetadata" JSONB,
ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Backfill input mode from legacy sourceMode when available.
UPDATE "AiSummary"
SET "inputMode" = "sourceMode"
WHERE "inputMode" IS NULL AND "sourceMode" IS NOT NULL;

-- Best-effort backfill contact linkage from existing interaction relationships.
UPDATE "AiSummary" AS summary
SET "contactId" = interaction."contactId"
FROM "Interaction" AS interaction
WHERE interaction."aiSummaryRecordId" = summary."id"
  AND summary."contactId" IS NULL;

-- Indexes for per-contact retrieval and retention jobs.
CREATE INDEX IF NOT EXISTS "AiSummary_contactId_generatedAt_idx"
ON "AiSummary"("contactId", "generatedAt");

CREATE INDEX IF NOT EXISTS "AiSummary_contactId_deletedAt_generatedAt_idx"
ON "AiSummary"("contactId", "deletedAt", "generatedAt");

CREATE INDEX IF NOT EXISTS "AiSummary_retentionUntil_idx"
ON "AiSummary"("retentionUntil");

-- Foreign key for contact linkage.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AiSummary_contactId_fkey'
  ) THEN
    ALTER TABLE "AiSummary"
    ADD CONSTRAINT "AiSummary_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

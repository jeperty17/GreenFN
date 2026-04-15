-- Expand: add optional AI summary record table and foreign key from Interaction.
CREATE TABLE IF NOT EXISTS "AiSummary" (
  "id" TEXT NOT NULL,
  "summaryText" TEXT NOT NULL,
  "model" TEXT,
  "sourceMode" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AiSummary_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Interaction"
ADD COLUMN IF NOT EXISTS "aiSummaryRecordId" TEXT;

CREATE INDEX IF NOT EXISTS "Interaction_aiSummaryRecordId_idx"
ON "Interaction"("aiSummaryRecordId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Interaction_aiSummaryRecordId_fkey'
  ) THEN
    ALTER TABLE "Interaction"
    ADD CONSTRAINT "Interaction_aiSummaryRecordId_fkey"
    FOREIGN KEY ("aiSummaryRecordId") REFERENCES "AiSummary"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

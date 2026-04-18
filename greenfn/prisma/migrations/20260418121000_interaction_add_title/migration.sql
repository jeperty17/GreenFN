-- Expand: add optional interaction title for concise one-line interaction summaries.
ALTER TABLE "Interaction"
ADD COLUMN IF NOT EXISTS "title" TEXT;

CREATE INDEX IF NOT EXISTS "Interaction_contactId_occurredAt_title_idx"
ON "Interaction"("contactId", "occurredAt", "title");

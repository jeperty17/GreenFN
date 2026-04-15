-- Expand: add direct advisor linkage on Interaction for per-advisor scoping.
ALTER TABLE "Interaction"
ADD COLUMN "advisorId" TEXT;

-- Backfill from existing contact ownership so current data is linked.
UPDATE "Interaction" i
SET "advisorId" = c."advisorId"
FROM "Contact" c
WHERE i."contactId" = c."id";

CREATE INDEX "Interaction_advisorId_idx" ON "Interaction"("advisorId");

ALTER TABLE "Interaction"
ADD CONSTRAINT "Interaction_advisorId_fkey"
FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

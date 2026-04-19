/*
  Warnings:

  - Made the column `dueAt` on table `NextStep` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill legacy rows so the NOT NULL conversion can succeed.
UPDATE "NextStep"
SET "dueAt" = COALESCE("createdAt", NOW())
WHERE "dueAt" IS NULL;

-- AlterTable
ALTER TABLE "NextStep" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "dueAt" SET NOT NULL;

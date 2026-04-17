/*
  Warnings:

  - Made the column `dueAt` on table `NextStep` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "NextStep" ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "dueAt" SET NOT NULL;

-- CreateEnum
CREATE TYPE "TaskActivityType" AS ENUM ('CREATED', 'UPDATED', 'COMPLETED', 'CANCELED', 'DELETED', 'REMINDER_TRIGGERED');

-- CreateTable
CREATE TABLE "TaskActivityLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "contactId" TEXT,
    "advisorId" TEXT,
    "activityType" "TaskActivityType" NOT NULL,
    "taskTitleSnapshot" TEXT NOT NULL,
    "contactNameSnapshot" TEXT NOT NULL,
    "dueAtSnapshot" TIMESTAMP(3),
    "statusSnapshot" "TaskStatus" NOT NULL,
    "detail" TEXT,
    "metadata" JSONB,
    "scheduledFor" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskActivityLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "NextStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskActivityLog" ADD CONSTRAINT "TaskActivityLog_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "TaskActivityLog_taskId_createdAt_idx" ON "TaskActivityLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivityLog_contactId_createdAt_idx" ON "TaskActivityLog"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivityLog_advisorId_createdAt_idx" ON "TaskActivityLog"("advisorId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskActivityLog_activityType_scheduledFor_idx" ON "TaskActivityLog"("activityType", "scheduledFor");
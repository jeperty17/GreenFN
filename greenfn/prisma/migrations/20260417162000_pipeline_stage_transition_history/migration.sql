-- CreateTable
CREATE TABLE "PipelineStageTransition" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "fromStageName" TEXT NOT NULL,
    "toStageId" TEXT NOT NULL,
    "toStageName" TEXT NOT NULL,
    "transitionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineStageTransition_contactId_transitionedAt_idx" ON "PipelineStageTransition"("contactId", "transitionedAt");

-- CreateIndex
CREATE INDEX "PipelineStageTransition_advisorId_transitionedAt_idx" ON "PipelineStageTransition"("advisorId", "transitionedAt");

-- CreateIndex
CREATE INDEX "PipelineStageTransition_fromStageId_idx" ON "PipelineStageTransition"("fromStageId");

-- CreateIndex
CREATE INDEX "PipelineStageTransition_toStageId_idx" ON "PipelineStageTransition"("toStageId");

-- AddForeignKey
ALTER TABLE "PipelineStageTransition" ADD CONSTRAINT "PipelineStageTransition_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStageTransition" ADD CONSTRAINT "PipelineStageTransition_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

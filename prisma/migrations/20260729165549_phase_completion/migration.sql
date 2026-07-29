-- CreateTable
CREATE TABLE "PhaseCompletion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phase" "Phase" NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "PhaseCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhaseCompletion_projectId_idx" ON "PhaseCompletion"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PhaseCompletion_projectId_phase_key" ON "PhaseCompletion"("projectId", "phase");

-- AddForeignKey
ALTER TABLE "PhaseCompletion" ADD CONSTRAINT "PhaseCompletion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhaseCompletion" ADD CONSTRAINT "PhaseCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

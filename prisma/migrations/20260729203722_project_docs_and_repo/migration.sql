-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "repoFullName" TEXT;

-- CreateTable
CREATE TABLE "ProjectDoc" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "docId" TEXT NOT NULL,
    "webViewLink" TEXT NOT NULL,
    "templateKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectDoc_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectDoc_docId_key" ON "ProjectDoc"("docId");

-- CreateIndex
CREATE INDEX "ProjectDoc_projectId_createdAt_idx" ON "ProjectDoc"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProjectDoc" ADD CONSTRAINT "ProjectDoc_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectDoc" ADD CONSTRAINT "ProjectDoc_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

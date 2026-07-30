-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "attachmentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_attachmentId_key" ON "Contract"("attachmentId");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

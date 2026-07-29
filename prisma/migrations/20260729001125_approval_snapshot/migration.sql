/*
  Warnings:

  - You are about to drop the column `snapshotId` on the `Approval` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Approval" DROP COLUMN "snapshotId",
ADD COLUMN     "snapshotNote" TEXT,
ADD COLUMN     "snapshotPreviewUrl" TEXT;

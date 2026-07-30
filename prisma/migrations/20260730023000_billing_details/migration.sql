-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "ico" TEXT,
ADD COLUMN     "address" TEXT;

-- CreateTable
CREATE TABLE "StudioProfile" (
    "id" TEXT NOT NULL DEFAULT 'studio',
    "name" TEXT,
    "ico" TEXT,
    "dic" TEXT,
    "address" TEXT,
    "bankAccount" TEXT,
    "representedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioProfile_pkey" PRIMARY KEY ("id")
);

-- DropForeignKey
ALTER TABLE "PhaseChange" DROP CONSTRAINT "PhaseChange_projectId_fkey";

-- DropForeignKey
ALTER TABLE "PhaseChange" DROP CONSTRAINT "PhaseChange_userId_fkey";

-- DropTable
DROP TABLE "PhaseChange";


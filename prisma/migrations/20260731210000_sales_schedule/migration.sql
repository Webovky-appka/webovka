-- CreateEnum
CREATE TYPE "SalesSchedule" AS ENUM ('NONE', 'WEEKDAYS', 'DAILY');

-- AlterTable
ALTER TABLE "SalesCampaign" ADD COLUMN     "schedule" "SalesSchedule" NOT NULL DEFAULT 'NONE';

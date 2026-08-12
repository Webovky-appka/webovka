-- Naplánované odeslání: nový stav a den, na který je e-mail naplánovaný
ALTER TYPE "SalesLeadStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';
ALTER TABLE "SalesLead" ADD COLUMN "scheduledFor" TIMESTAMP(3);

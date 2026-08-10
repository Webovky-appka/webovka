-- Company research: háčky pro úvod e-mailu (recenze, novinky, sezóna, nábory)
ALTER TABLE "SalesLead" ADD COLUMN "research" JSONB;
ALTER TABLE "SalesLead" ADD COLUMN "researchAt" TIMESTAMP(3);

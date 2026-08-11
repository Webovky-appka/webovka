-- Vzor hodnocení webu se dá vypnout, aniž by se muselo smazat
ALTER TABLE "SalesLead" ADD COLUMN "humanWebActive" BOOLEAN NOT NULL DEFAULT true;

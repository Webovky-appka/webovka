-- Globální přepínače AI Sales (jeden řádek, pevné id)
CREATE TABLE "SalesConfig" (
    "id" TEXT NOT NULL DEFAULT 'sales',
    "designerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesConfig_pkey" PRIMARY KEY ("id")
);

-- Vzorové e-maily: takhle má Outreach psát (tón a stavba, nikdy fakta)
CREATE TABLE "SalesEmailSample" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "note" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesEmailSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesEmailSample_active_idx" ON "SalesEmailSample"("active");

ALTER TABLE "SalesEmailSample" ADD CONSTRAINT "SalesEmailSample_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

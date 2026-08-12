-- Historie úprav návrhu e-mailu: stav před každou změnou + pokyn, který ji vyvolal
CREATE TABLE "SalesEmailRevision" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "instruction" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesEmailRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesEmailRevision_draftId_createdAt_idx" ON "SalesEmailRevision"("draftId", "createdAt");

ALTER TABLE "SalesEmailRevision" ADD CONSTRAINT "SalesEmailRevision_draftId_fkey"
    FOREIGN KEY ("draftId") REFERENCES "SalesEmailDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesEmailRevision" ADD CONSTRAINT "SalesEmailRevision_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

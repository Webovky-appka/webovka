-- Fáze přestávají být pevný výčet a stávají se řádky patřícími zakázce.
-- Migrace existující data převádí, nezahazuje je: z každé zakázky vznikne pět
-- fází s dosavadními názvy a přenese se, které byly ukončené.

-- 1. Nové tabulky
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PhaseTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    CONSTRAINT "PhaseTemplate_pkey" PRIMARY KEY ("id")
);

-- 2. Z každé zakázky vytvoříme dosavadních pět fází ve správném pořadí.
INSERT INTO "ProjectPhase" ("id", "projectId", "name", "position", "completedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    v."name",
    v."position",
    pc."completedAt"
FROM "Project" p
CROSS JOIN (VALUES
    ('Zadání', 0, 'BRIEF'),
    ('Návrh', 1, 'DESIGN'),
    ('Vývoj', 2, 'BUILD'),
    ('Schválení', 3, 'REVIEW'),
    ('Live', 4, 'LIVE')
) AS v("name", "position", "enumValue")
LEFT JOIN "PhaseCompletion" pc
    ON pc."projectId" = p."id" AND pc."phase"::text = v."enumValue";

-- Termín zakázky patřil aktuální fázi, přeneseme ho na ni.
UPDATE "ProjectPhase" ph
SET "dueDate" = p."dueDate"
FROM "Project" p
WHERE ph."projectId" = p."id"
  AND p."dueDate" IS NOT NULL
  AND ph."name" = CASE p."phase"::text
      WHEN 'BRIEF' THEN 'Zadání'
      WHEN 'DESIGN' THEN 'Návrh'
      WHEN 'BUILD' THEN 'Vývoj'
      WHEN 'REVIEW' THEN 'Schválení'
      ELSE 'Live'
  END;

-- 3. Úkoly navážeme na fázi své zakázky.
ALTER TABLE "Task" ADD COLUMN "phaseId" TEXT;

UPDATE "Task" t
SET "phaseId" = ph."id"
FROM "ProjectPhase" ph
WHERE ph."projectId" = t."projectId"
  AND ph."name" = CASE t."phase"::text
      WHEN 'BRIEF' THEN 'Zadání'
      WHEN 'DESIGN' THEN 'Návrh'
      WHEN 'BUILD' THEN 'Vývoj'
      WHEN 'REVIEW' THEN 'Schválení'
      ELSE 'Live'
  END;

-- Úkol bez fáze by neměl kde být, takové by převod nechal viset.
DELETE FROM "Task" WHERE "phaseId" IS NULL;
ALTER TABLE "Task" ALTER COLUMN "phaseId" SET NOT NULL;
ALTER TABLE "Task" DROP COLUMN "phase";

-- 4. Schválení si nese název fáze jako doklad, i kdyby fáze později zmizela.
ALTER TABLE "Approval" ADD COLUMN "phaseId" TEXT;
ALTER TABLE "Approval" ADD COLUMN "phaseName" TEXT;

UPDATE "Approval" a
SET "phaseName" = CASE a."phase"::text
        WHEN 'BRIEF' THEN 'Zadání'
        WHEN 'DESIGN' THEN 'Návrh'
        WHEN 'BUILD' THEN 'Vývoj'
        WHEN 'REVIEW' THEN 'Schválení'
        ELSE 'Live'
    END;

UPDATE "Approval" a
SET "phaseId" = ph."id"
FROM "ProjectPhase" ph
WHERE ph."projectId" = a."projectId" AND ph."name" = a."phaseName";

ALTER TABLE "Approval" ALTER COLUMN "phaseName" SET NOT NULL;
ALTER TABLE "Approval" DROP COLUMN "phase";

-- 5. Předloha úkolů se rozpadá na předlohu fází a jejich úkolů.
INSERT INTO "PhaseTemplate" ("id", "name", "position")
VALUES
    (gen_random_uuid()::text, 'Zadání', 0),
    (gen_random_uuid()::text, 'Návrh', 1),
    (gen_random_uuid()::text, 'Vývoj', 2),
    (gen_random_uuid()::text, 'Schválení', 3),
    (gen_random_uuid()::text, 'Live', 4);

ALTER TABLE "TaskTemplate" ADD COLUMN "phaseTemplateId" TEXT;

UPDATE "TaskTemplate" tt
SET "phaseTemplateId" = pt."id"
FROM "PhaseTemplate" pt
WHERE pt."name" = CASE tt."phase"::text
        WHEN 'BRIEF' THEN 'Zadání'
        WHEN 'DESIGN' THEN 'Návrh'
        WHEN 'BUILD' THEN 'Vývoj'
        WHEN 'REVIEW' THEN 'Schválení'
        ELSE 'Live'
    END;

DELETE FROM "TaskTemplate" WHERE "phaseTemplateId" IS NULL;
ALTER TABLE "TaskTemplate" ALTER COLUMN "phaseTemplateId" SET NOT NULL;
ALTER TABLE "TaskTemplate" DROP COLUMN "phase";

-- 6. Zakázka: dva odkazy na web, pevná fáze a termín odcházejí.
ALTER TABLE "Project" ADD COLUMN "currentSiteUrl" TEXT;
ALTER TABLE "Project" DROP COLUMN "phase";
ALTER TABLE "Project" DROP COLUMN "dueDate";

-- 7. Příloha může patřit k úkolu.
ALTER TABLE "Attachment" ADD COLUMN "taskId" TEXT;

-- 8. Původní tabulky a typ už nemají co držet.
ALTER TABLE "PhaseCompletion" DROP CONSTRAINT "PhaseCompletion_projectId_fkey";
ALTER TABLE "PhaseCompletion" DROP CONSTRAINT "PhaseCompletion_userId_fkey";
DROP TABLE "PhaseCompletion";
DROP INDEX IF EXISTS "Task_projectId_phase_position_idx";
DROP INDEX IF EXISTS "TaskTemplate_phase_position_idx";
DROP TYPE "Phase";

-- 9. Indexy a cizí klíče
CREATE UNIQUE INDEX "ProjectPhase_projectId_position_key" ON "ProjectPhase"("projectId", "position");
CREATE INDEX "ProjectPhase_projectId_position_idx" ON "ProjectPhase"("projectId", "position");
CREATE UNIQUE INDEX "PhaseTemplate_position_key" ON "PhaseTemplate"("position");
CREATE INDEX "TaskTemplate_phaseTemplateId_position_idx" ON "TaskTemplate"("phaseTemplateId", "position");
CREATE INDEX "Task_phaseId_position_idx" ON "Task"("phaseId", "position");
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX "Attachment_taskId_idx" ON "Attachment"("taskId");

ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_phaseTemplateId_fkey" FOREIGN KEY ("phaseTemplateId") REFERENCES "PhaseTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Stávající web klienta patří ke klientovi, ne k zakázce — nemění se podle toho,
-- co pro něj právě děláme. Klient už pole website má, takže hodnoty přeneseme.
UPDATE "Client" c
SET "website" = p."currentSiteUrl"
FROM "Project" p
WHERE p."clientId" = c."id"
  AND p."currentSiteUrl" IS NOT NULL
  AND (c."website" IS NULL OR c."website" = '');

ALTER TABLE "Project" DROP COLUMN "currentSiteUrl";

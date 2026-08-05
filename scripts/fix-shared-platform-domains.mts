import path from "node:path";

import { SHARED_PLATFORM_DOMAINS } from "../src/lib/sales/dedupe";

/**
 * Jednorázová oprava prospectů, kterým Scout dřív uložil jako doménu holou
 * sdílenou platformu (facebook.com, instagram.com…). Taková hodnota podnik
 * neidentifikuje: blokovala deduplikaci pro všechny další firmy na platformě
 * a auditor kvůli ní stahoval root platformy místo stránky podniku. Doména se
 * maže — správnou adresu stránky lze doplnit ručně, automaticky ji z historie
 * nezjistíme.
 *
 * Použití:
 *   npx tsx scripts/fix-shared-platform-domains.mts                          (náhled proti .env)
 *   npx tsx scripts/fix-shared-platform-domains.mts --apply                  (zapíše změny)
 *   npx tsx scripts/fix-shared-platform-domains.mts --env-file .env.production --apply
 */
const args = process.argv.slice(2);
const apply = args.includes("--apply");
const envFileIndex = args.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? args[envFileIndex + 1] : ".env";

const dotenv = await import("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), envFile), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    `Chybí DATABASE_URL. Nenašel jsem ji v prostředí ani v souboru ${envFile}.`,
  );
  process.exit(1);
}

function describeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(nepodařilo se přečíst hostitele)";
  }
}

/** Holý host sdílené platformy — bez cesty a parametrů, které by nesly identitu. */
function isBareSharedPlatform(domain: string): boolean {
  if (domain.includes("/") || domain.includes("?")) return false;
  return SHARED_PLATFORM_DOMAINS.some(
    (base) => domain === base || domain.endsWith(`.${base}`),
  );
}

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

console.log(`Databáze: ${describeTarget(databaseUrl)}`);
console.log(apply ? "Režim: zápis změn" : "Režim: náhled (spusťte s --apply pro zápis)");

const prospects = await prisma.prospect.findMany({
  where: { domain: { not: null } },
  select: {
    id: true,
    name: true,
    domain: true,
    leads: { select: { status: true } },
  },
});

const affected = prospects.filter(
  (prospect) => prospect.domain !== null && isBareSharedPlatform(prospect.domain),
);

if (affected.length === 0) {
  console.log("Žádný prospect s holou sdílenou platformou v doméně. Není co opravovat.");
} else {
  for (const prospect of affected) {
    const statuses = prospect.leads.map((lead) => lead.status).join(", ") || "bez leadů";
    console.log(`- ${prospect.name} (${prospect.id}): ${prospect.domain} → null [leady: ${statuses}]`);

    if (apply) {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { domain: null },
      });
    }
  }

  console.log(
    apply
      ? `Hotovo, doména smazána u ${affected.length} prospectů. Stránku podniku lze doplnit ručně.`
      : `Náhled: změnilo by se ${affected.length} prospectů.`,
  );
}

await prisma.$disconnect();

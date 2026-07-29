import { execSync } from "node:child_process";
import path from "node:path";

/**
 * Build pro Vercel. Migrace se aplikují samy, ale výhradně u produkčního
 * nasazení — Preview i Production míří na stejnou databázi, takže kdyby
 * migroval každý build, nasazení náhledu z rozpracované větve by změnilo
 * schéma produkce dřív, než je tam odpovídající kód.
 */
const vercelEnv = process.env.VERCEL_ENV ?? "(nenastaveno)";

// Potomci spuštění přes execSync nedědí node_modules/.bin, které npm přidává
// jen svým vlastním skriptům. Bez toho by "prisma" ani "next" nebyly na PATH.
const localBin = path.join(process.cwd(), "node_modules", ".bin");
const pathWithLocalBin = [localBin, process.env.PATH]
  .filter(Boolean)
  .join(path.delimiter);

function run(command, extraEnv = {}) {
  console.log(`[build] ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: { ...process.env, PATH: pathWithLocalBin, ...extraEnv },
  });
}

if (vercelEnv === "production") {
  // Migrace jsou DDL a přes connection pooler mohou selhat, takže pokud Neon
  // nabízí přímé spojení, použijeme pro ně jeho URL.
  const migrationUrl =
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.DATABASE_URL;

  if (!migrationUrl) {
    console.error(
      "[build] Chybí DATABASE_URL, migrace nelze aplikovat. Nastavte ji v proměnných projektu.",
    );
    process.exit(1);
  }

  run("prisma migrate deploy", { DATABASE_URL: migrationUrl });
} else {
  console.log(
    `[build] VERCEL_ENV=${vercelEnv}, migrace se nespouštějí. Aplikují se až při nasazení do produkce.`,
  );
}

run("next build");

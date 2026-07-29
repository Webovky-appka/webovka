import readline from "node:readline";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Zakládá a přehesluje interní účty (admin, vývojář). Heslo se zadává skrytě,
 * takže nezůstane v historii shellu ani v build logu.
 *
 * Použití:
 *   npm run user:create                                  (proti .env)
 *   npm run user:create -- --env-file .env.production    (proti produkci)
 */
const args = process.argv.slice(2);
const envFileIndex = args.indexOf("--env-file");
const envFile = envFileIndex >= 0 ? args[envFileIndex + 1] : ".env";

const dotenv = await import("dotenv");
dotenv.config({ path: path.resolve(process.cwd(), envFile), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(
    `Chybí DATABASE_URL. Nenašel jsem ji v prostředí ani v souboru ${envFile}.\n` +
      `Produkční hodnotu stáhnete příkazem:\n` +
      `  npx vercel env pull .env.production --environment=production`,
  );
  process.exit(1);
}

/**
 * Na terminálu se ptáme postupně a heslo skrýváme. Když vstup přichází z pipe
 * (typicky v testu), přečteme ho celý najednou — readline by u přesměrovaného
 * vstupu část řádků zahodil, protože je vyčte dřív, než se zaregistruje další
 * dotaz.
 */
const interactive = Boolean(process.stdin.isTTY);

let rl = null;
let pipedLines = null;

if (interactive) {
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
} else {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  pipedLines = Buffer.concat(chunks).toString("utf8").split("\n");
}

function closeInput() {
  rl?.close();
}

function ask(question, { hidden = false } = {}) {
  if (!interactive) {
    process.stdout.write(`${question}\n`);
    return Promise.resolve((pipedLines.shift() ?? "").trim());
  }

  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => resolve(answer.trim()));
      return;
    }

    // Potlačíme vypisování znaků, aby heslo nebylo vidět na obrazovce.
    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = () => {};
    process.stdout.write(question);

    rl.question("", (answer) => {
      rl._writeToOutput = originalWrite;
      rl.history = [];
      process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

/** Aby nešlo omylem přehesolvat produkci, když jste mířil na lokál. */
function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname}`;
  } catch {
    return "(nepodařilo se přečíst hostitele)";
  }
}

console.log(`Databáze: ${describeTarget(databaseUrl)}`);
const confirmTarget = await ask("Je to ta správná databáze? [ano/ne] ");
if (confirmTarget.toLowerCase() !== "ano") {
  console.log("Zrušeno, nic se nezměnilo.");
  closeInput();
  process.exit(0);
}

const email = (await ask("E-mail: ")).toLowerCase();
if (!email.includes("@")) {
  console.error("To nevypadá jako e-mail.");
  closeInput();
  process.exit(1);
}

const name = await ask("Jméno (zobrazuje se v aplikaci): ");
if (name === "") {
  console.error("Jméno nesmí být prázdné.");
  closeInput();
  process.exit(1);
}

const roleAnswer = await ask("Role – [a]dmin nebo [v]ývojář: ");
const role = roleAnswer.toLowerCase().startsWith("v") ? "DEVELOPER" : "ADMIN";

const password = await ask("Heslo (nebude se zobrazovat): ", { hidden: true });
if (password.length < 10) {
  console.error("Heslo musí mít alespoň 10 znaků.");
  closeInput();
  process.exit(1);
}

const passwordAgain = await ask("Heslo znovu: ", { hidden: true });
if (password !== passwordAgain) {
  console.error("Hesla se neshodují.");
  closeInput();
  process.exit(1);
}

closeInput();

const { PrismaClient } = await import("@prisma/client");
const { PrismaPg } = await import("@prisma/adapter-pg");
const argon2 = (await import("argon2")).default;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const passwordHash = await argon2.hash(password);

const existing = await prisma.user.findUnique({ where: { email } });

const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, name, role },
  create: { email, name, role, passwordHash },
  select: { email: true, name: true, role: true },
});

console.log(
  existing
    ? `Účet ${user.email} byl aktualizován (jméno, role a heslo).`
    : `Účet ${user.email} byl založen jako ${user.role === "ADMIN" ? "admin" : "vývojář"}.`,
);

await prisma.$disconnect();

// Bez tohohle by soubor nešel importovat v testech, kdyby na to jednou přišlo.
export const scriptUrl = pathToFileURL(import.meta.url).href;

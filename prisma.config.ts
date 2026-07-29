import { defineConfig } from "prisma/config";
import "dotenv/config";

/**
 * Pozor na env() z prisma/config: při chybějící proměnné vyhodí výjimku už při
 * načtení configu, takže by spadlo i `prisma generate`. Generování klienta je
 * ale offline operace — databázi potřebují jen migrace a studio. Na Vercelu
 * to jinak shodí celý build ve fázi npm install.
 */
const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});

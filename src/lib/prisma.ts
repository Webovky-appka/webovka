import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Chybí DATABASE_URL. Zkopírujte .env.example na .env.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

function getPrismaClient(): PrismaClient {
  // Hot reload v devu by jinak otevíral nové spojení při každé změně.
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma ??= createPrismaClient();
    return globalForPrisma.prisma;
  }

  cachedClient ??= createPrismaClient();
  return cachedClient;
}

let cachedClient: PrismaClient | undefined;

/**
 * Klient se vytváří až při prvním použití. Kdyby vznikal při importu modulu,
 * `next build` by vyžadoval DATABASE_URL — sběr dat stránek totiž moduly
 * importuje — a build by padal na proměnné, která je potřeba až za běhu.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient() as unknown as Record<
      string | symbol,
      unknown
    >;
    const value = client[property];
    return typeof value === "function" ? value.bind(client) : value;
  },
});

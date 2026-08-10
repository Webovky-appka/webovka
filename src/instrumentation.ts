import * as Sentry from "@sentry/nextjs";

/**
 * Vstupní bod observability (konvence Next.js). Podle runtime načte
 * odpovídající Sentry konfiguraci; bez DSN zůstává všechno vypnuté.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Server chyby zachycené Nextem (render RSC, Server Actions, routy) —
 * včetně těch, které React přebalí a nechá z nich jen digest.
 */
export const onRequestError = Sentry.captureRequestError;

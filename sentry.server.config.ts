import * as Sentry from "@sentry/nextjs";

/**
 * Hlášení chyb Node.js runtime (stránky, Server Actions, API routy).
 * Bez nastaveného DSN je SDK vypnuté a aplikace běží jako dřív.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Jen chyby, žádný performance tracing — šetří free kvótu Sentry
  // a neposílá ven údaje o každém požadavku.
  tracesSampleRate: 0,

  // Do událostí nepatří IP adresy ani cookies — v aplikaci jsou osobní
  // údaje klientů a stack trace s adresou stránky na diagnostiku stačí.
  sendDefaultPii: false,
});

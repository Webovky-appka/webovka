import * as Sentry from "@sentry/nextjs";

/**
 * Hlášení chyb edge runtime — u nás jen proxy (middleware).
 * Bez nastaveného DSN je SDK vypnuté.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

import * as Sentry from "@sentry/nextjs";

/**
 * Hlášení chyb v prohlížeči. Eventy jdou přes tunel `/monitoring`
 * (viz next.config.ts), takže projdou naším CSP `connect-src 'self'`
 * i adblockery. Bez DSN je SDK vypnuté.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),

  // Jen chyby — performance tracing a session replay nechceme kvůli
  // kvótě i soukromí (aplikace zobrazuje osobní údaje klientů).
  tracesSampleRate: 0,
  sendDefaultPii: false,
});

/** Navigace App Routeru — dává chybám kontext, na které stránce vznikly. */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

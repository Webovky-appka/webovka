import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Balíčky pro screenshoty webů se nesmí bundlovat: @sparticuz/chromium
   * nese binárku prohlížeče, puppeteer je jen lokální vývojová náhrada
   * a nesmí se řešit při buildu na Vercelu, kde není nainstalovaný.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
  /**
   * Binárku Chromia (bin/*.br) načítá @sparticuz/chromium přes fs až za
   * běhu, takže ji trasování souborů nevidí a bez tohoto výčtu se do
   * function bundle na Vercelu vůbec nedostane — spuštění prohlížeče tam
   * pak potichu selže a audit běží jen z HTML.
   */
  outputFileTracingIncludes: {
    "/api/sales/runs/\\[id\\]/tick": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
    ],
    // Ruční přeaudit je server action stránky detailu příležitosti.
    "/sales/leads/\\[id\\]": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    serverActions: {
      /**
       * Server Actions mají tělo požadavku ve výchozím stavu omezené na 1 MB,
       * takže nahrání jakékoli fotky z telefonu selhalo ještě předtím, než se
       * akce vůbec spustila — kontrola velikosti v akci se k tomu nedostala a
       * uživatel viděl jen obecnou chybu.
       *
       * Nastaveno výš než MAX_UPLOAD_BYTES, aby na hranici narazila naše
       * kontrola s českou zprávou, ne framework.
       */
      bodySizeLimit: "8mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  // Slugy nejsou tajemství (jsou vidět v adrese Sentry) — natvrdo tady,
  // ať upload source map funguje hned, jak na Vercelu přibude auth token.
  org: process.env.SENTRY_ORG ?? "danielmitka",
  project: process.env.SENTRY_PROJECT ?? "mitsov-web",
  authToken: process.env.SENTRY_AUTH_TOKEN,

  /**
   * Klientské eventy jdou na vlastní doménu místo *.ingest.sentry.io —
   * jinak by je zablokovalo naše CSP (connect-src 'self') a adblockery.
   */
  tunnelRoute: "/monitoring",

  // Bez auth tokenu (lokálně, CI) se source mapy nenahrávají a build
  // o tom nemá vypisovat varování; čitelné stack traces řeší až Vercel.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  silent: true,
});

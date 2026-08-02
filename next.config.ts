import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Balíčky pro screenshoty webů se nesmí bundlovat: @sparticuz/chromium
   * nese binárku prohlížeče, puppeteer je jen lokální vývojová náhrada
   * a nesmí se řešit při buildu na Vercelu, kde není nainstalovaný.
   */
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "puppeteer"],
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

export default nextConfig;

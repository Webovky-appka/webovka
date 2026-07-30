import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

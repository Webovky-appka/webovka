import type { MetadataRoute } from "next";

/** Interní nástroj ani klientské portály nemají co dělat ve vyhledávačích. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}

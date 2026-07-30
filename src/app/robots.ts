import type { MetadataRoute } from "next";

/**
 * Interní nástroj ani klientské portály nemají co dělat ve vyhledávačích.
 * Výjimkou jsou právní dokumenty — na zásady odkazuje souhlasná obrazovka
 * Googlu, takže robotům zavřené být nemají.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/privacy", "/terms"], disallow: "/" },
    ],
  };
}

import "server-only";

/**
 * Levné nahlédnutí na web firmy pro kvalifikaci — titulek, popis, nadpisy
 * a kus textu. Žádný headless prohlížeč; screenshoty a hluboký audit přijdou
 * s Auditorem. Doména sem přichází už znormalizovaná (bez IP a localhostu).
 */
const TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 400_000;
const EXCERPT_CHARS = 1_800;

export type SiteSummary = {
  finalUrl: string;
  title: string | null;
  description: string | null;
  headings: string[];
  excerpt: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " "),
  ).trim();
}

export async function fetchSiteSummary(
  domain: string,
): Promise<SiteSummary | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`https://${domain}`, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        // Bez User-Agenta řada webů vrací 403.
        "User-Agent":
          "Mozilla/5.0 (compatible; MitsovWebBot/1.0; +https://mitsov.cz)",
        Accept: "text/html",
      },
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;

    const raw = await response.text();
    const html = raw.slice(0, MAX_HTML_BYTES);

    const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? null;
    const description =
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i.exec(
        html,
      )?.[1] ??
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i.exec(
        html,
      )?.[1] ??
      null;

    const headings: string[] = [];
    for (const match of html.matchAll(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi)) {
      const text = stripTags(match[1] ?? "");
      if (text !== "" && headings.length < 8) headings.push(text.slice(0, 120));
    }

    // Tělo bez hlavičky, ať výňatek nezačíná menu a cookies lištou.
    const bodyHtml = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;

    return {
      finalUrl: response.url,
      title: title ? stripTags(title).slice(0, 200) : null,
      description: description ? decodeEntities(description).slice(0, 300) : null,
      headings,
      excerpt: stripTags(bodyHtml).slice(0, EXCERPT_CHARS),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

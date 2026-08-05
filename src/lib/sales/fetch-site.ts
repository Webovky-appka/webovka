import "server-only";

/**
 * Levné nahlédnutí na web firmy pro kvalifikaci — titulek, popis, nadpisy
 * a kus textu. Žádný headless prohlížeč; screenshoty a hluboký audit přijdou
 * s Auditorem. Doména sem přichází už znormalizovaná (bez IP a localhostu);
 * u firem na sdílené platformě obsahuje i cestu ke stránce podniku
 * (facebook.com/nazevpodniku), takže se stahuje stránka firmy, ne root platformy.
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

/**
 * Bohatší pohled pro Auditora. Pořád jen HTML — signály, které jdou vyčíst
 * bez vykreslení: viewport, počty obrázků a formulářů, texty odkazů a delší
 * výňatek. Co z HTML nejde poznat, musí audit označit jako úsudek.
 */
export type AuditContent = SiteSummary & {
  hasViewportMeta: boolean;
  imageCount: number;
  imagesWithAlt: number;
  formCount: number;
  navLinks: string[];
  htmlBytes: number;
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

function parseSummary(html: string, finalUrl: string): SiteSummary {
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

  const bodyHtml = /<body[\s\S]*<\/body>/i.exec(html)?.[0] ?? html;

  return {
    finalUrl,
    title: title ? stripTags(title).slice(0, 200) : null,
    description: description ? decodeEntities(description).slice(0, 300) : null,
    headings,
    excerpt: stripTags(bodyHtml).slice(0, EXCERPT_CHARS),
  };
}

async function fetchHtml(
  domain: string,
): Promise<{ html: string; finalUrl: string } | null> {
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
    return { html: raw.slice(0, MAX_HTML_BYTES), finalUrl: response.url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSiteSummary(
  domain: string,
): Promise<SiteSummary | null> {
  const page = await fetchHtml(domain);
  if (!page) return null;
  return parseSummary(page.html, page.finalUrl);
}

export async function fetchAuditContent(
  domain: string,
): Promise<AuditContent | null> {
  const page = await fetchHtml(domain);
  if (!page) return null;

  const { html, finalUrl } = page;
  const summary = parseSummary(html, finalUrl);

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const navLinks: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(match[1] ?? "");
    if (text !== "" && text.length <= 40 && !navLinks.includes(text)) {
      navLinks.push(text);
    }
    if (navLinks.length >= 20) break;
  }

  return {
    ...summary,
    // Delší výňatek než u kvalifikace — audit potřebuje víc kontextu.
    excerpt: summary.excerpt,
    hasViewportMeta: /<meta[^>]+name=["']viewport["']/i.test(html),
    imageCount: images.length,
    imagesWithAlt: images.filter((tag) => /\balt=["'][^"']+["']/i.test(tag))
      .length,
    formCount: (html.match(/<form\b/gi) ?? []).length,
    navLinks,
    htmlBytes: html.length,
  };
}

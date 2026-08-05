import "server-only";

import { saveRawFile } from "@/lib/storage";

/**
 * Screenshoty webu pro vizuální audit a Designer (sekce 9.2 specifikace).
 * Domovská stránka desktop + mobil a k tomu pár podstránek — rezervace,
 * galerie nebo ceník bývají jinde a audit by webu bez nich křivdil.
 * Ukládá se JPEG, protože je několikanásobně menší než PNG a pro posouzení
 * vizuálu i náhled stačí.
 *
 * Prohlížeč: na Vercelu @sparticuz/chromium (binárka přibalená v balíčku),
 * lokálně plný puppeteer s vlastním Chrome. Oba balíčky jsou
 * v serverExternalPackages, aby je build nebundloval.
 */

export const SCREENSHOT_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

export type ScreenshotKind = keyof typeof SCREENSHOT_VIEWPORTS;

/** Kolik podstránek se fotí navíc k domovské stránce. */
export const MAX_EXTRA_PAGES = 2;

const PAGE_TIMEOUT_MS = 30_000;
const JPEG_QUALITY = 80;
/** Čas na doběhnutí animací, lazyload obrázků a zavření cookie lišty. */
const SETTLE_MS = 1_200;

/**
 * Deterministický klíč v úložišti — opakovaný audit screenshot přepíše,
 * nevznikají osiřelé soubory.
 */
export function salesScreenshotKey(leadId: string, kind: string): string {
  return `sales/${leadId}/${kind}.jpg`;
}

export const SCREENSHOT_CONTENT_TYPE = "image/jpeg";

/**
 * Texty tlačítek, kterými se zavírají cookie lišty. Nejdřív odmítnutí
 * (fotíme cizí web, nesbíráme nic navíc), souhlas až jako poslední záchrana,
 * když lišta jinak zakrývá celou stránku.
 */
export const COOKIE_BUTTON_TEXTS = [
  "odmítnout vše",
  "odmítnout",
  "pouze nezbytné",
  "jen nezbytné",
  "nezbytné cookies",
  "reject all",
  "decline",
  "přijmout vše",
  "přijmout",
  "souhlasím",
  "rozumím",
  "accept all",
  "i agree",
] as const;

/** Klíčová slova podstránek, které mají pro audit největší cenu. */
export const SUBPAGE_KEYWORDS = [
  "rezervace",
  "booking",
  "ubytovani",
  "ubytování",
  "pokoje",
  "galerie",
  "gallery",
  "menu",
  "cenik",
  "ceník",
  "sluzby",
  "služby",
  "kontakt",
] as const;

type Browser = {
  newPage(): Promise<Page>;
  close(): Promise<void>;
};

type Page = {
  setViewport(viewport: {
    width: number;
    height: number;
    isMobile?: boolean;
    hasTouch?: boolean;
  }): Promise<void>;
  goto(
    url: string,
    options: { waitUntil: "networkidle2"; timeout: number },
  ): Promise<unknown>;
  evaluate<T>(fn: string): Promise<T>;
  screenshot(options: { type: "jpeg"; quality: number }): Promise<Uint8Array>;
  close(): Promise<void>;
};

async function launchBrowser(): Promise<Browser> {
  // Na Vercelu není systémový Chrome; @sparticuz/chromium ho nese s sebou.
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    return (await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })) as unknown as Browser;
  }

  // Lokálně plný puppeteer (devDependency) s Chrome staženým přes
  // `npx puppeteer browsers install chrome`.
  const puppeteer = (await import("puppeteer")).default;
  return (await puppeteer.launch({ headless: true })) as unknown as Browser;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Zavře cookie lištu, pokud nějaká je — jinak by zabrala celý snímek.
 * Skript běží v prohlížeči: najde první viditelné tlačítko s known textem.
 */
function dismissCookieScript(): string {
  const texts = JSON.stringify(COOKIE_BUTTON_TEXTS);
  return `(() => {
    const wanted = ${texts};
    const candidates = Array.from(
      document.querySelectorAll('button, a[role="button"], [class*="cookie"] a, [id*="cookie"] a'),
    );
    for (const text of wanted) {
      const hit = candidates.find((el) => {
        const label = (el.textContent || "").trim().toLowerCase();
        if (!label || label.length > 40) return false;
        const rect = el.getBoundingClientRect();
        return label.includes(text) && rect.width > 0 && rect.height > 0;
      });
      if (hit) {
        hit.click();
        return text;
      }
    }
    return null;
  })()`;
}

/** Projede stránku dolů a zpět, aby se donačetly lazyload obrázky. */
const LAZYLOAD_SCROLL_SCRIPT = `(async () => {
  const step = window.innerHeight;
  for (let y = 0; y < document.body.scrollHeight && y < 8000; y += step) {
    window.scrollTo(0, y);
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  window.scrollTo(0, 0);
  return true;
})()`;

/** Skript vytáhne interní odkazy z navigace pro focení podstránek. */
const NAV_LINKS_SCRIPT = `(() => {
  const links = Array.from(document.querySelectorAll("a[href]"))
    .map((a) => ({ href: a.href, label: (a.textContent || "").trim() }))
    .filter((l) => l.href.startsWith(location.origin) && l.label.length > 1);
  const seen = new Set();
  return links.filter((l) => {
    const path = new URL(l.href).pathname.replace(/\\/$/, "");
    if (!path || path === "" || seen.has(path)) return false;
    seen.add(path);
    return true;
  }).slice(0, 40);
})()`;

/** Vybere nejcennější podstránky podle klíčových slov, pak podle pořadí. */
export function pickSubpages(
  links: { href: string; label: string }[],
  limit: number = MAX_EXTRA_PAGES,
): { href: string; label: string }[] {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");

  const scored = links.map((link) => {
    const haystack = normalize(`${link.label} ${link.href}`);
    const index = SUBPAGE_KEYWORDS.findIndex((keyword) =>
      haystack.includes(normalize(keyword)),
    );
    return { link, priority: index === -1 ? Number.MAX_SAFE_INTEGER : index };
  });

  return scored
    .sort((a, b) => a.priority - b.priority)
    .slice(0, limit)
    .map((item) => item.link);
}

async function settleAndShoot(page: Page): Promise<Buffer> {
  await page.evaluate(dismissCookieScript()).catch(() => null);
  await page.evaluate(LAZYLOAD_SCROLL_SCRIPT).catch(() => null);
  await sleep(SETTLE_MS);
  return Buffer.from(
    await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY }),
  );
}

export type PageCapture = { label: string; data: Buffer };

export type ScreenshotCapture = {
  desktop: Buffer;
  mobile: Buffer;
  /** Podstránky (jen desktop) — rezervace, galerie, ceník… */
  extraPages: PageCapture[];
};

/**
 * Vyfotí web: domovskou stránku v obou rozměrech a až MAX_EXTRA_PAGES
 * podstránek. Chyba čehokoli (spuštění prohlížeče, timeout, mrtvý web)
 * vrací null — audit pak poběží jen z HTML, screenshot nikdy nesmí
 * shodit pipeline. Selhání jedné podstránky nezahazuje zbytek.
 */
export async function captureScreenshots(
  url: string,
): Promise<ScreenshotCapture | null> {
  let browser: Browser | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setViewport(SCREENSHOT_VIEWPORTS.desktop);
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PAGE_TIMEOUT_MS,
    });
    const desktop = await settleAndShoot(page);

    const navLinks = await page
      .evaluate<{ href: string; label: string }[]>(NAV_LINKS_SCRIPT)
      .catch(() => [] as { href: string; label: string }[]);

    // Mobil má vlastní načtení — responzivní weby přeskládávají layout
    // podle viewportu při načtení, ne při pouhé změně velikosti.
    await page.setViewport({
      ...SCREENSHOT_VIEWPORTS.mobile,
      isMobile: true,
      hasTouch: true,
    });
    await page.goto(url, {
      waitUntil: "networkidle2",
      timeout: PAGE_TIMEOUT_MS,
    });
    const mobile = await settleAndShoot(page);

    const extraPages: PageCapture[] = [];
    const currentPath = (() => {
      try {
        return new URL(url).pathname.replace(/\/$/, "");
      } catch {
        return "";
      }
    })();
    const subpages = pickSubpages(
      navLinks.filter((link) => {
        try {
          return new URL(link.href).pathname.replace(/\/$/, "") !== currentPath;
        } catch {
          return false;
        }
      }),
    );

    await page.setViewport(SCREENSHOT_VIEWPORTS.desktop);
    for (const subpage of subpages) {
      try {
        await page.goto(subpage.href, {
          waitUntil: "networkidle2",
          timeout: PAGE_TIMEOUT_MS,
        });

        // Chybová stránka není podstránka — SPA weby bez fallbacku vrací
        // na přímých odkazech 404 a model by dostal jen prázdné snímky.
        const title = await page
          .evaluate<string>("document.title")
          .catch(() => "");
        if (/404|not found|nenalezen/i.test(title)) {
          console.error(
            `[sales] Podstránka ${subpage.href} vypadá jako 404 („${title}“), přeskočena.`,
          );
          continue;
        }

        const shot = await settleAndShoot(page);
        // Bajtově shodný snímek nic nepřidá (druhá 404, redirect na domů).
        if (
          shot.equals(desktop) ||
          extraPages.some((existing) => existing.data.equals(shot))
        ) {
          continue;
        }

        extraPages.push({ label: subpage.label.slice(0, 40), data: shot });
      } catch (error) {
        console.error(
          `[sales] Screenshot podstránky ${subpage.href} selhal:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    return { desktop, mobile, extraPages };
  } catch (error) {
    // Screenshot nesmí shodit audit, ale selhání musí být vidět v lozích —
    // na Vercelu je to jediná stopa (v aktivitě je pak jen screenshots: false).
    console.error(
      `[sales] Screenshot ${url} selhal:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

export type StoredPage = { label: string; key: string };

/**
 * Vyfotí web leadu a uloží snímky pod deterministické klíče.
 * Vrací klíče a byty (byty jdou rovnou do multimodálního auditu).
 */
export async function captureAndStore(
  leadId: string,
  url: string,
): Promise<{
  desktopKey: string;
  mobileKey: string;
  pages: StoredPage[];
  capture: ScreenshotCapture;
} | null> {
  const capture = await captureScreenshots(url);
  if (!capture) return null;

  const desktopKey = salesScreenshotKey(leadId, "desktop");
  const mobileKey = salesScreenshotKey(leadId, "mobile");
  await saveRawFile(desktopKey, capture.desktop, SCREENSHOT_CONTENT_TYPE);
  await saveRawFile(mobileKey, capture.mobile, SCREENSHOT_CONTENT_TYPE);

  const pages: StoredPage[] = [];
  for (const [index, page] of capture.extraPages.entries()) {
    const key = salesScreenshotKey(leadId, `page-${index}`);
    await saveRawFile(key, page.data, SCREENSHOT_CONTENT_TYPE);
    pages.push({ label: page.label, key });
  }

  return { desktopKey, mobileKey, pages, capture };
}

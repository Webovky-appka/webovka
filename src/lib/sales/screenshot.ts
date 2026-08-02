import "server-only";

import { saveRawFile } from "@/lib/storage";

/**
 * Screenshoty webu pro vizuální audit a Designer (sekce 9.2 specifikace).
 * Desktop a mobil v rozměrech ze specifikace; ukládá se JPEG, protože je
 * několikanásobně menší než PNG a pro posouzení vizuálu i náhled stačí.
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

const PAGE_TIMEOUT_MS = 30_000;
const JPEG_QUALITY = 80;

/**
 * Deterministický klíč v úložišti — opakovaný audit screenshot přepíše,
 * nevznikají osiřelé soubory.
 */
export function salesScreenshotKey(leadId: string, kind: ScreenshotKind): string {
  return `sales/${leadId}/${kind}.jpg`;
}

export const SCREENSHOT_CONTENT_TYPE = "image/jpeg";

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
  screenshot(options: { type: "jpeg"; quality: number }): Promise<Uint8Array>;
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

export type ScreenshotCapture = { desktop: Buffer; mobile: Buffer };

/**
 * Vyfotí web v obou rozměrech. Chyba čehokoli (spuštění prohlížeče, timeout,
 * mrtvý web) vrací null — audit pak poběží jen z HTML jako dřív, screenshot
 * nikdy nesmí shodit pipeline.
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
    const desktop = Buffer.from(
      await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY }),
    );

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
    const mobile = Buffer.from(
      await page.screenshot({ type: "jpeg", quality: JPEG_QUALITY }),
    );

    return { desktop, mobile };
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}

/**
 * Vyfotí web leadu a uloží oba snímky pod deterministické klíče.
 * Vrací klíče a byty (byty jdou rovnou do multimodálního auditu).
 */
export async function captureAndStore(
  leadId: string,
  url: string,
): Promise<{
  desktopKey: string;
  mobileKey: string;
  capture: ScreenshotCapture;
} | null> {
  const capture = await captureScreenshots(url);
  if (!capture) return null;

  const desktopKey = salesScreenshotKey(leadId, "desktop");
  const mobileKey = salesScreenshotKey(leadId, "mobile");
  await saveRawFile(desktopKey, capture.desktop, SCREENSHOT_CONTENT_TYPE);
  await saveRawFile(mobileKey, capture.mobile, SCREENSHOT_CONTENT_TYPE);

  return { desktopKey, mobileKey, capture };
}

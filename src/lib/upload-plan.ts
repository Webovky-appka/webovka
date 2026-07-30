/**
 * Strop na velikost přílohy. Držíme ho pod 4,5 MB, což je limit Vercelu na
 * tělo požadavku do serverless funkce — nad ním se nahrávání v produkci
 * neodmítne naší zprávou, ale spadne na 413 ještě před aplikací.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/**
 * Povolené typy. Skripty a spustitelné soubory tady nemají co dělat.
 * Konstanty jsou tady, ne v storage.ts, protože je potřebuje i políčko
 * v prohlížeči — a storage.ts je server-only a sahá na node:fs.
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
] as const;

/**
 * Co udělat s vybraným souborem, ještě než se začne nahrávat. Dialog na výběr
 * souboru se podle velikosti filtrovat nedá — atribut accept umí jen typy —
 * takže velký soubor odmítáme nebo zmenšujeme až po vybrání.
 */
export type UploadPlan =
  | { action: "upload" }
  | { action: "shrink" }
  | { action: "refuse"; reason: string };

/**
 * Formáty, které umíme překódovat bez ztráty podstaty. Animovaný GIF by přišel
 * o animaci a SVG je kresba, kterou by rastrování zničilo — u těch se velikost
 * řeší odmítnutím, ne tichou přeměnou.
 */
export const SHRINKABLE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function megabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function planUpload(
  file: { type: string; size: number },
  maxBytes: number,
): UploadPlan {
  if (file.size === 0) {
    return { action: "refuse", reason: "Soubor je prázdný." };
  }
  if (file.size <= maxBytes) return { action: "upload" };

  if (SHRINKABLE_TYPES.includes(file.type)) return { action: "shrink" };

  return {
    action: "refuse",
    reason: `Soubor má ${megabytes(file.size)} a limit je ${megabytes(maxBytes)}. Zmenšit umíme jen fotky (JPEG, PNG, WebP) — tenhle typ ne, takže ho zmenšete nebo rozdělte sám.`,
  };
}

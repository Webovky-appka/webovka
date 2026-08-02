import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Limity a povolené typy potřebuje i políčko v prohlížeči, proto žijí zvlášť.
export { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "./upload-plan";





const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

function driver(): "local" | "blob" {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

/**
 * Vercel Blob se autorizuje dvěma způsoby: dlouhodobým BLOB_READ_WRITE_TOKEN,
 * nebo krátkodobým OIDC tokenem, ke kterému je ale potřeba id storu. Integrace
 * Blobu ve Vercelu dodává druhou variantu (BLOB_STORE_ID + VERCEL_OIDC_TOKEN),
 * takže storeId předáváme, kdykoli ho známe — bez něj by nahrávání selhalo na
 * chybějícím tokenu.
 */
function blobOptions(): { storeId?: string } {
  const storeId = process.env.BLOB_STORE_ID;
  return storeId ? { storeId } : {};
}

/**
 * Klíč v úložišti. Nikdy nepoužíváme jméno souboru od uživatele — mohlo by
 * obsahovat cestu nebo kolidovat s jiným souborem.
 */
export function buildStorageKey(clientId: string, filename: string): string {
  const extension = path.extname(filename).slice(0, 10).toLowerCase();
  const safeExtension = /^\.[a-z0-9]+$/.test(extension) ? extension : "";
  return `${clientId}/${crypto.randomUUID()}${safeExtension}`;
}

export async function saveFile(
  clientId: string,
  file: File,
): Promise<{ storageKey: string }> {
  const storageKey = buildStorageKey(clientId, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (driver() === "blob") {
    const { put } = await import("@vercel/blob");
    await put(storageKey, bytes, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
      ...blobOptions(),
    });
    return { storageKey };
  }

  const target = path.join(LOCAL_ROOT, storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return { storageKey };
}

/**
 * Uložení hotových bytů pod deterministický klíč — pro soubory, které vyrábí
 * aplikace sama (screenshoty webů). Opakované uložení stejný klíč přepíše,
 * takže volající nemusí řešit úklid starých verzí.
 */
export async function saveRawFile(
  storageKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  if (driver() === "blob") {
    const { put } = await import("@vercel/blob");
    await put(storageKey, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      ...blobOptions(),
    });
    return;
  }

  const target = path.join(LOCAL_ROOT, storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  if (driver() === "blob") {
    const { head } = await import("@vercel/blob");
    const meta = await head(storageKey, blobOptions());
    const response = await fetch(meta.url);
    return Buffer.from(await response.arrayBuffer());
  }

  return fs.readFile(path.join(LOCAL_ROOT, storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (driver() === "blob") {
    const { del } = await import("@vercel/blob");
    await del(storageKey, blobOptions());
    return;
  }

  const target = path.join(LOCAL_ROOT, storageKey);
  await fs.rm(target, { force: true });

  // Adresář je pojmenovaný podle id klienta, takže po výmazu nemá zůstat ani on.
  // rmdir na neprázdném adresáři selže, což je přesně chtěné chování.
  await fs.rmdir(path.dirname(target)).catch(() => {});
}

import "server-only";

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

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

const LOCAL_ROOT = path.join(process.cwd(), ".uploads");

function driver(): "local" | "blob" {
  return process.env.STORAGE_DRIVER === "blob" ? "blob" : "local";
}

/**
 * Klíč v úložišti. Nikdy nepoužíváme jméno souboru od uživatele — mohlo by
 * obsahovat cestu nebo kolidovat s jiným souborem.
 */
function buildKey(clientId: string, filename: string): string {
  const extension = path.extname(filename).slice(0, 10).toLowerCase();
  const safeExtension = /^\.[a-z0-9]+$/.test(extension) ? extension : "";
  return `${clientId}/${crypto.randomUUID()}${safeExtension}`;
}

export async function saveFile(
  clientId: string,
  file: File,
): Promise<{ storageKey: string }> {
  const storageKey = buildKey(clientId, file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  if (driver() === "blob") {
    const { put } = await import("@vercel/blob");
    await put(storageKey, bytes, {
      access: "public",
      contentType: file.type,
      addRandomSuffix: false,
    });
    return { storageKey };
  }

  const target = path.join(LOCAL_ROOT, storageKey);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
  return { storageKey };
}

export async function readFile(storageKey: string): Promise<Buffer> {
  if (driver() === "blob") {
    const { head } = await import("@vercel/blob");
    const meta = await head(storageKey);
    const response = await fetch(meta.url);
    return Buffer.from(await response.arrayBuffer());
  }

  return fs.readFile(path.join(LOCAL_ROOT, storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (driver() === "blob") {
    const { del } = await import("@vercel/blob");
    await del(storageKey);
    return;
  }

  await fs.rm(path.join(LOCAL_ROOT, storageKey), { force: true });
}

import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/**
 * Šifrování cizích tokenů, které musíme mít v databázi — konkrétně refresh
 * tokenu od Googlu. Kdyby někdo získal výpis databáze, samotný token mu nestačí.
 *
 * Klíč se odvozuje ze SESSION_SECRET, aby nebyla potřeba další proměnná.
 * Důsledek: změna SESSION_SECRET zneplatní uložená napojení na Gmail stejně,
 * jako zneplatní přihlášení — napojení se pak udělá znovu.
 */
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_INFO = "web-appka:oauth-token:v1";

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET není nastavený nebo je příliš krátký.");
  }

  return Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), "", KEY_INFO, 32),
  );
}

/** Vrací "iv.tag.šifra" v base64url, ať se vejde do jednoho textového pole. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

/** Vrátí null, když je záznam poškozený nebo zašifrovaný jiným klíčem. */
export function decryptSecret(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 3) return null;

  try {
    const [iv, tag, payload] = parts as [string, string, string];
    const decipher = createDecipheriv(
      ALGORITHM,
      key(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(payload, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

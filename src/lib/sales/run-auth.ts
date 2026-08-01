import "server-only";

import crypto from "node:crypto";

/**
 * Token pro ticky, které si server posílá sám sobě (řetěz běhu) — nemají
 * session cookie. Odvozený ze SESSION_SECRET, žádná další proměnná.
 */
export function salesTickToken(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("Chybí SESSION_SECRET.");

  return crypto
    .createHmac("sha256", secret)
    .update("sales-tick:v1")
    .digest("base64url");
}

export function isValidTickToken(value: string | null): boolean {
  if (!value) return false;

  const expected = salesTickToken();
  const provided = Buffer.from(value);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length) return false;

  return crypto.timingSafeEqual(provided, wanted);
}

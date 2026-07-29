import crypto from "node:crypto";

const SESSION_TTL_SECONDS = 60 * 60 * 12;
const PORTAL_TTL_SECONDS = 60 * 60 * 24 * 7;

export const SESSION_COOKIE = "webappka_session";
export const PORTAL_COOKIE_PREFIX = "webappka_portal_";

type SessionPayload = {
  /** Předmět session: id uživatele u interní části, id portálového odkazu u klienta. */
  sub: string;
  exp: number;
};

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error(
      "Chybí SESSION_SECRET. Vygenerujte jej pomocí: openssl rand -base64 32",
    );
  }
  return value;
}

function sign(data: string): string {
  return crypto
    .createHmac("sha256", secret())
    .update(data)
    .digest("base64url");
}

export function createToken(sub: string, ttlSeconds: number): string {
  const payload: SessionPayload = {
    sub,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = sign(body);

  // timingSafeEqual vyhodí u různých délek, proto délku kontrolujeme zvlášť.
  if (signature.length !== expected.length) return null;
  if (
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function createSessionToken(userId: string): string {
  return createToken(userId, SESSION_TTL_SECONDS);
}

export function createPortalToken(portalLinkId: string): string {
  return createToken(portalLinkId, PORTAL_TTL_SECONDS);
}

export function portalCookieName(portalLinkId: string): string {
  return `${PORTAL_COOKIE_PREFIX}${portalLinkId}`;
}

export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export { SESSION_TTL_SECONDS, PORTAL_TTL_SECONDS };

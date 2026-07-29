import "server-only";

import crypto from "node:crypto";

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
const DEFAULT_VALIDITY_DAYS = 90;

/**
 * Token do URL. Hashujeme jej deterministicky (SHA-256), aby šel odkaz dohledat,
 * ale v databázi nebyl v čitelné podobě. PIN naopak hashujeme argon2, protože
 * má jen milion kombinací a záznam už máme dohledaný podle tokenu.
 */
export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPortalToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generatePin(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function defaultExpiry(): Date {
  return new Date(Date.now() + DEFAULT_VALIDITY_DAYS * 86_400_000);
}

export function isLinkUsable(link: {
  active: boolean;
  expiresAt: Date | null;
}): boolean {
  if (!link.active) return false;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) return false;
  return true;
}

export function isLocked(link: { lockedUntil: Date | null }): boolean {
  return Boolean(link.lockedUntil && link.lockedUntil.getTime() > Date.now());
}

export function portalUrl(token: string): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/portal/${token}`;
}

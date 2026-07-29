import "server-only";

import { appUrl } from "@/lib/mail";
import { buildRawMessage, toBase64Url } from "@/lib/mime";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/secrets";

/**
 * Napojení na Gmail. Odesíláme e-maily jménem přihlášeného uživatele, takže
 * klientovi přijde zpráva z jeho vlastní adresy a odpověď mu dorazí do Gmailu.
 *
 * Google dává refresh token jen při access_type=offline a prompt=consent.
 * U aplikace v režimu Testing platí refresh token 7 dní — potom přihlášení
 * vyprší a musí se udělat znovu. Chová se to jako chyba invalid_grant, kterou
 * tady zachytáváme a napojení rovnou zrušíme, ať je v UI vidět, co se stalo.
 * Jak se sedmidenního limitu zbavit, je v DEPLOYMENT.md, sekce 4c.
 */
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

/**
 * drive.file dává právo jen k souborům, které aplikace sama vytvořila — na
 * ostatní obsah Drive nevidí. Proto se dokumenty nedají zakládat kopií šablony
 * z Drive a předlohy držíme v aplikaci.
 */
export const DOCS_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** gmail.send umí jen odesílat — na čtení pošty nemá aplikace právo. */
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  DOCS_SCOPE,
  "openid",
  "email",
].join(" ");

/**
 * Účty napojené před přidáním Docs mají v uloženém scope jen gmail.send.
 * Odesílání pošty jim funguje dál, na zakládání dokumentů se musí napojit znovu.
 */
export function hasDocsAccess(scope: string | null | undefined): boolean {
  return Boolean(scope?.includes("drive.file"));
}

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

export function googleRedirectUri(): string {
  return appUrl("/api/google/callback");
}

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(
  body: Record<string, string>,
): Promise<TokenResponse | null> {
  try {
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
      cache: "no-store",
    });

    const data = (await response.json()) as TokenResponse;
    if (!response.ok) {
      console.error(
        `[google] Token endpoint vrátil ${response.status}: ${data.error ?? "bez kódu"}`,
      );
    }
    return data;
  } catch (error) {
    console.error("[google] Spojení s token endpointem selhalo:", error);
    return null;
  }
}

/**
 * Adresa účtu z id_tokenu. Podpis neověřujeme záměrně — token jsme právě dostali
 * přímo od Googlu přes TLS jako odpověď na náš požadavek, ne od prohlížeče.
 */
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;

  const payload = idToken.split(".")[1];
  if (!payload) return null;

  try {
    const decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { email?: string };
    return decoded.email ?? null;
  } catch {
    return null;
  }
}

export type ConnectResult = { email: string } | { error: string };

/** Vymění kód z přesměrování za tokeny a uloží napojení k uživateli. */
export async function connectGoogleAccount(
  userId: string,
  code: string,
): Promise<ConnectResult> {
  const data = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });

  if (!data || data.error || !data.access_token) {
    return { error: "Google nevydal přístupový token." };
  }
  if (!data.refresh_token) {
    return {
      error:
        "Google nevrátil trvalý token. Odeberte aplikaci v nastavení účtu Google a zkuste napojení znovu.",
    };
  }
  if (!data.scope?.includes("gmail.send")) {
    return { error: "Chybí oprávnění k odesílání pošty." };
  }

  const email = emailFromIdToken(data.id_token);
  if (!email) {
    return { error: "Nepodařilo se zjistit adresu účtu Google." };
  }

  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;

  await prisma.googleAccount.upsert({
    where: { userId },
    create: {
      userId,
      email,
      refreshToken: encryptSecret(data.refresh_token),
      accessToken: encryptSecret(data.access_token),
      expiresAt,
      scope: data.scope,
    },
    update: {
      email,
      refreshToken: encryptSecret(data.refresh_token),
      accessToken: encryptSecret(data.access_token),
      expiresAt,
      scope: data.scope,
    },
  });

  return { email };
}

const EXPIRY_MARGIN_MS = 60_000;

export type AccessToken = { token: string } | { error: string };

/** Vrátí platný access token, případně si ho obnoví refresh tokenem. */
export async function accessTokenFor(userId: string): Promise<AccessToken> {
  const account = await prisma.googleAccount.findUnique({
    where: { userId },
    select: {
      accessToken: true,
      expiresAt: true,
      refreshToken: true,
    },
  });

  if (!account) return { error: "Účet není napojený na Gmail." };

  if (
    account.accessToken &&
    account.expiresAt &&
    account.expiresAt.getTime() - EXPIRY_MARGIN_MS > Date.now()
  ) {
    const cached = decryptSecret(account.accessToken);
    if (cached) return { token: cached };
  }

  const refreshToken = decryptSecret(account.refreshToken);
  if (!refreshToken) {
    // Nejčastěji po změně SESSION_SECRET — starý záznam už nerozšifrujeme.
    await prisma.googleAccount.delete({ where: { userId } });
    return {
      error: "Uložené napojení na Gmail nelze přečíst. Napojte účet znovu.",
    };
  }

  const data = await tokenRequest({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });

  if (!data || data.error === "invalid_grant") {
    await prisma.googleAccount.delete({ where: { userId } });
    return {
      error:
        "Přihlášení ke Gmailu vypršelo. Napojte účet znovu — u aplikace v režimu Testing to Google vyžaduje každých 7 dní.",
    };
  }
  if (!data.access_token) {
    return { error: "Gmail nevydal nový přístupový token." };
  }

  await prisma.googleAccount.update({
    where: { userId },
    data: {
      accessToken: encryptSecret(data.access_token),
      expiresAt: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null,
    },
  });

  return { token: data.access_token };
}

export type SendResult = { sent: true } | { error: string };

export async function sendGmail({
  userId,
  from,
  fromName,
  to,
  subject,
  body,
}: {
  userId: string;
  from: string;
  fromName: string | null;
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const token = await accessTokenFor(userId);
  if ("error" in token) return { error: token.error };

  const raw = toBase64Url(
    buildRawMessage({ to, from, fromName, subject, body }),
  );

  try {
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      console.error(
        `[google] Odeslání selhalo (${response.status}): ${detail?.error?.message ?? "bez popisu"}`,
      );
      return {
        error:
          response.status === 403
            ? "Gmail odeslání odmítl. Zkontrolujte, že je v Google Cloudu zapnuté Gmail API."
            : "Gmail zprávu nepřijal. Podrobnost je v logu serveru.",
      };
    }
  } catch (error) {
    console.error("[google] Spojení s Gmailem selhalo:", error);
    return { error: "Nepodařilo se spojit s Gmailem." };
  }

  return { sent: true };
}

/** Zruší napojení a odvolá token i na straně Googlu. */
export async function disconnectGoogleAccount(userId: string): Promise<void> {
  const account = await prisma.googleAccount.findUnique({
    where: { userId },
    select: { refreshToken: true },
  });
  if (!account) return;

  const refreshToken = decryptSecret(account.refreshToken);
  if (refreshToken) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: refreshToken }).toString(),
        cache: "no-store",
      });
    } catch (error) {
      // Když odvolání nevyjde, aspoň zapomeneme token u sebe.
      console.error("[google] Odvolání tokenu selhalo:", error);
    }
  }

  await prisma.googleAccount.delete({ where: { userId } });
}

export async function googleAccountFor(userId: string) {
  return prisma.googleAccount.findUnique({
    where: { userId },
    select: { email: true, createdAt: true, scope: true },
  });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

/** Cesty interní části. Mimo ně proxy jen doplňuje bezpečnostní hlavičky. */
const INTERNAL_PATH = /^\/(projects|clients|settings|docs)(\/|$)/;

function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Nonce se nevztahuje na inline style atributy, které používáme u progress barů.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    // Náhled webu klienta se vkládá do rámu, takže cizí https adresy povolit
    // musíme. Rám je zavřený v sandboxu a nemá k naší stránce přístup.
    "frame-src https:",
    // next/font si fonty hostuje sám, žádný externí zdroj nepotřebujeme.
    "font-src 'self'",
    isDev ? "connect-src 'self' ws: wss:" : "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function applySecurityHeaders(
  response: NextResponse,
  csp: string,
  isDev: boolean,
): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // HSTS má smysl jen přes HTTPS, na localhostu by zablokoval vývoj.
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains",
    );
  }

  return response;
}

/**
 * Doplňuje bezpečnostní hlavičky všem odpovědím a nepřihlášené odklání
 * z interní části. Jde jen o optimistickou kontrolu přítomnosti cookie —
 * skutečné ověření session dělá requireUser() na stránkách a v Server Actions.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = buildCsp(nonce, isDev);

  const isInternal = INTERNAL_PATH.test(request.nextUrl.pathname);
  if (isInternal && !request.cookies.has(SESSION_COOKIE)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl), csp, isDev);
  }

  // Nonce musí dorazit i do renderu, aby jej Next.js vložil do svých script tagů.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    csp,
    isDev,
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};

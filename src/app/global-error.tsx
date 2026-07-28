"use client";

import "./globals.css";

/**
 * Zachytává chyby v root layoutu, který v takové situaci nedoběhne — proto si
 * tahle stránka musí vykreslit vlastní html a body.
 *
 * Záměrně nepoužívá unstable_retry ani jiný JavaScript: Next.js tuhle stránku
 * prerenderuje při buildu, kdy ještě není znám nonce, takže by jí CSP skripty
 * zablokovala a tlačítko by nic nedělalo. Odkaz na úvod funguje vždy a plný
 * reload má při havárii rootu větší šanci na úspěch než React retry.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html lang="cs">
      <body className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-lg font-semibold text-slate-900">
            Aplikace se nespustila
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Došlo k neočekávané chybě. Zkuste stránku načíst znovu, případně to
            zkuste za chvíli.
          </p>
          <a
            href="/"
            className="mt-5 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Načíst znovu
          </a>
          {error.digest ? (
            <p className="mt-6 font-mono text-xs text-slate-400">
              Kód chyby: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}

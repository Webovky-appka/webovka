"use client";

import { useEffect } from "react";

/**
 * Chybová stránka pro klienta. Záměrně bez technických detailů a bez kódu
 * chyby — klient s ním nic neudělá a jen ho to znejistí. Do konzole se
 * chyba zaloguje pro nás.
 */
export default function PortalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Stránku teď nejde zobrazit
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Zkuste to prosím za chvíli znovu. Pokud to nepomůže, napište nám
          a projekt vám pošleme jinou cestou.
        </p>
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Zkusit znovu
        </button>
      </div>
    </main>
  );
}

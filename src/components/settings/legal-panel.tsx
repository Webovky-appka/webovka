import Link from "next/link";

import { EFFECTIVE_DATE, missingOperatorFields } from "@/lib/legal";

const DOCUMENTS = [
  {
    href: "/privacy",
    label: "Zásady ochrany osobních údajů",
    note: "Google je vyžaduje k ověření aplikace, klient je najde pod přihlášením i v portálu.",
  },
  {
    href: "/terms",
    label: "Podmínky užívání",
    note: "Pravidla, za kterých klient portál používá.",
  },
];

/**
 * Odkazy na právní stránky a upozornění, co v nich ještě chybí. Nedokončený
 * dokument se nesmí dostat ke klientovi ani do souhlasné obrazovky Googlu, tak
 * je to vidět rovnou v Nastavení, ne až na stránce samotné.
 */
export function LegalPanel() {
  const missing = missingOperatorFields();

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Právní dokumenty
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Účinnost od {EFFECTIVE_DATE}. Text se mění v souboru{" "}
          <span className="font-mono">src/lib/legal.ts</span>, ne tady.
        </p>
      </div>

      {missing.length > 0 ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">
            Než dokumenty někomu pošlete, doplňte údaje provozovatele.
          </p>
          <ul className="mt-1 space-y-0.5 text-xs">
            {missing.map((field) => (
              <li key={field.label}>
                {field.label} — {field.hint}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            Vyplňuje se v <span className="font-mono">OPERATOR</span> v souboru{" "}
            <span className="font-mono">src/lib/legal.ts</span>.
          </p>
        </div>
      ) : (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Údaje provozovatele jsou doplněné, dokumenty jde zveřejnit.
        </p>
      )}

      <ul className="space-y-3">
        {DOCUMENTS.map((doc) => (
          <li key={doc.href}>
            <Link
              href={doc.href}
              target="_blank"
              className="text-sm text-sky-700 underline hover:text-sky-900"
            >
              {doc.label}
            </Link>
            <p className="mt-0.5 text-xs text-slate-500">{doc.note}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

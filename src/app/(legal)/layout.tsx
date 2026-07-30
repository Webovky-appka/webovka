import Link from "next/link";

import { EFFECTIVE_DATE, SERVICE_NAME } from "@/lib/legal";

/**
 * Rámec právních stránek. Jsou veřejné — Google na zásady odkazuje ze souhlasné
 * obrazovky a klient si je má přečíst, aniž by se kamkoli přihlašoval.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="font-semibold tracking-tight text-slate-900">
            {SERVICE_NAME}
          </p>
          <p className="text-xs text-slate-500">
            Účinnost od {EFFECTIVE_DATE}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-4 px-4 py-4 text-xs text-slate-500">
          <Link href="/privacy" className="transition hover:text-slate-900">
            Zásady ochrany osobních údajů
          </Link>
          <Link href="/terms" className="transition hover:text-slate-900">
            Podmínky užívání
          </Link>
          <Link href="/login" className="transition hover:text-slate-900">
            Přihlášení
          </Link>
        </div>
      </footer>
    </div>
  );
}

"use client";

import { setGoogleAccountIndex } from "@/app/actions/account";
import { AutoSaveInput, SaveIndicator } from "@/components/auto-save";

/**
 * Pořadí účtu Google pro rychlé odkazy v navigaci. Nastavuje si ho každý sám,
 * protože v prohlížeči má každý přihlášené jiné účty v jiném pořadí.
 */
export function GoogleLinksForm({ index }: { index: number | null }) {
  return (
    <form action={setGoogleAccountIndex} className="space-y-1.5">
      <label
        htmlFor="googleAccountIndex"
        className="block text-sm font-medium text-slate-700"
      >
        Váš účet Google pro odkazy v navigaci
      </label>

      <div className="flex items-center gap-2">
        <AutoSaveInput
          name="googleAccountIndex"
          type="number"
          min={0}
          max={20}
          defaultValue={index === null ? "" : String(index)}
          ariaLabel="Pořadí účtu Google"
          placeholder="např. 6"
          allowEmpty
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <SaveIndicator />
      </div>

      <p className="text-xs text-slate-500">
        Číslo z adresy, když jste přihlášen v Gmailu:{" "}
        <span className="font-mono">mail.google.com/mail/u/</span>
        <span className="font-mono font-semibold text-slate-700">6</span> znamená
        šestku. Je to pořadí účtu v prohlížeči, ne jeho jméno, takže každý má
        jiné. Prázdné políčko použije výchozí nastavení.
      </p>
    </form>
  );
}

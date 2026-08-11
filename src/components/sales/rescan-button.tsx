"use client";

import { useActionState } from "react";

import { rescanLead, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/**
 * Kompletní proskenování příležitosti. Práci odpracuje běh kampaně, takže
 * akce přesměruje na jeho stránku — tlačítko jen říká, co se stane.
 */
export function RescanButton({
  leadId,
  label = "Proskenovat znovu",
  prominent = false,
  centered = false,
}: {
  leadId: string;
  label?: string;
  prominent?: boolean;
  /** Uprostřed prázdného rámu vypadá zarovnání doleva jako chyba. */
  centered?: boolean;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    rescanLead,
    undefined,
  );

  return (
    <form
      action={formAction}
      className={`space-y-2 ${centered ? "flex flex-col items-center text-center" : ""}`}
    >
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className={
          prominent
            ? "rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        }
      >
        {pending ? "Spouštím proskenování…" : label}
      </button>
      <p
        className={`max-w-md text-xs ${prominent ? "text-slate-500" : "text-slate-400"}`}
      >
        Audit webu se snímky, kontakty, research a nový návrh e-mailu. Trvá pár
        minut, postup uvidíte na stránce běhu.
      </p>
      <FormError message={state?.error} />
    </form>
  );
}

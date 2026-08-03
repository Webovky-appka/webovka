"use client";

import { useActionState } from "react";

import { reauditLead, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/**
 * Ruční přeaudit webu. Trvá kolem minuty (screenshoty + model), takže
 * tlačítko po odeslání jasně říká, že se pracuje.
 */
export function ReauditButton({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    reauditLead,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Audituji… (~1 minuta)" : "Přeauditovat web"}
      </button>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { undoWon, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/** Záchrana pro překlik na Vyhráno. Klienta ani zakázku nemaže. */
export function UndoWonButton({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    undoWon,
    undefined,
  );

  return (
    <form action={formAction} className="mt-3 space-y-1">
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="text-xs text-emerald-800/80 underline-offset-2 hover:text-emerald-950 hover:underline disabled:opacity-60"
      >
        {pending ? "Vracím…" : "↩ Kliknul jsem omylem — vzít výhru zpět"}
      </button>
      <p className="text-xs text-emerald-800/70">
        Vrátí příležitost mezi oslovené. Založený klient i zakázka zůstávají —
        smazat je jde v Zakázkách.
      </p>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-white/70 px-3 py-2 text-xs text-emerald-900">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

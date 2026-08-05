"use client";

import { useActionState } from "react";

import { reopenLead, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/** Vrátí zamítnutou příležitost do hry — stav se dopočítá z toho, co už má. */
export function ReopenButton({ leadId }: { leadId: string }) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    reopenLead,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
      >
        {pending ? "Otevírám…" : "Znovu otevřít příležitost"}
      </button>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState } from "react";

import { startRun, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/** Spuštění běhu kampaně. Úspěch přesměruje na stránku běhu, která ho krokuje. */
export function StartRunForm({
  campaignId,
  disabled,
  disabledReason,
}: {
  campaignId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    startRun,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Spouštím…" : "Spustit běh"}
        </button>
        {disabled && disabledReason ? (
          <span className="text-xs text-slate-500">{disabledReason}</span>
        ) : null}
      </div>
      <FormError message={state?.error} />
    </form>
  );
}

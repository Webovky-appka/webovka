"use client";

import { useActionState } from "react";

import { savePrompt, type SalesFormState } from "@/app/actions/sales";
import { FormError, inputClasses } from "@/components/field";

/**
 * Úprava system promptu jednoho agenta. Uložení vytvoří novou verzi — staré
 * se nemažou, běhy agentů na ně odkazují a výsledky se podle nich srovnávají.
 */
export function PromptEditor({
  agent,
  agentName,
  system,
  version,
}: {
  agent: string;
  agentName: string;
  system: string;
  /** null = výchozí prompt z kódu, do databáze zatím nikdo nesáhl. */
  version: number | null;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    savePrompt,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="agent" value={agent} />

      <textarea
        name="system"
        rows={12}
        defaultValue={system}
        aria-label={`System prompt agenta ${agentName}`}
        className={`${inputClasses} font-mono text-xs`}
      />

      <input
        name="notes"
        placeholder="Poznámka k verzi (nepovinné) — co a proč se změnilo"
        aria-label="Poznámka k verzi"
        className={inputClasses}
      />

      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Uložit jako novou verzi"}
        </button>
        <span className="text-xs text-slate-500">
          {version === null
            ? "Běží na výchozím promptu z kódu."
            : `Aktivní verze ${version}.`}
        </span>
      </div>
    </form>
  );
}

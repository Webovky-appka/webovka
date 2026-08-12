"use client";

import { useActionState } from "react";

import { saveOwnerNote, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/**
 * Vlastní poznámka k příležitosti. Do promptů nechodí — je to lidská paměť,
 * proč jsme firmu odložili a kdy to zkusit znovu. Ukazuje se i v seznamu
 * zamítnutých v kampani.
 */
export function OwnerNoteForm({
  leadId,
  note,
}: {
  leadId: string;
  note: string | null;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    saveOwnerNote,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <label
        htmlFor={`owner-note-${leadId}`}
        className="block text-xs font-medium tracking-wide text-slate-500 uppercase"
      >
        Vaše poznámka k téhle firmě
      </label>
      <textarea
        id={`owner-note-${leadId}`}
        name="note"
        rows={2}
        maxLength={500}
        defaultValue={note ?? ""}
        placeholder="Např.: web je dost dobrý, zkusit na jaře; majitel řešil rekonstrukci"
        className="field-sizing-content min-h-16 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Uložit poznámku"}
        </button>
        <span className="text-xs text-slate-500">
          Uvidíte ji i v seznamu zamítnutých. Modelu se neposílá.
        </span>
      </div>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="text-xs text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}

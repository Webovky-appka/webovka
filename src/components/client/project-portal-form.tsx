"use client";

import { useActionState } from "react";

import {
  updateProjectPortal,
  type ProjectFormState,
} from "@/app/actions/projects";
import { Field, FormError, TextareaField } from "@/components/field";

export function ProjectPortalForm({
  projectId,
  portalNote,
  previewUrl,
  dueDate,
}: {
  projectId: string;
  portalNote: string | null;
  previewUrl: string | null;
  dueDate: Date | null;
}) {
  const [state, formAction, pending] = useActionState<
    ProjectFormState,
    FormData
  >(updateProjectPortal, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <TextareaField
        label="Poznámka pro klienta"
        name="portalNote"
        defaultValue={portalNote}
        rows={3}
        hint="Zobrazí se klientovi v portálu. Interní poznámky se tam nikdy nedostanou."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Odkaz na náhled webu"
          name="previewUrl"
          defaultValue={previewUrl}
          placeholder="https://"
        />
        <Field
          label="Očekávaný termín fáze"
          name="dueDate"
          type="date"
          defaultValue={dueDate ? dueDate.toISOString().slice(0, 10) : ""}
          hint="Prázdné = klientovi se termín nezobrazí."
        />
      </div>

      <FormError message={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Ukládám…" : "Uložit"}
      </button>
    </form>
  );
}

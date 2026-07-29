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
}: {
  projectId: string;
  portalNote: string | null;
  previewUrl: string | null;
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

      <Field
        label="Náš nový web"
        name="previewUrl"
        defaultValue={previewUrl}
        placeholder="https://"
        hint="Testovací verze nebo už spuštěný web. Klient ho uvidí v portálu."
      />

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

"use client";

import { useActionState, useRef } from "react";

import { createProject, type ProjectFormState } from "@/app/actions/projects";
import { FormError } from "@/components/field";

export function NewProjectForm({ clientId }: { clientId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    ProjectFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await createProject(prevState, formData);
    if (!result?.error) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form ref={formRef} action={formAction} className="space-y-2">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="flex gap-2">
        <input
          name="name"
          placeholder="Název nové zakázky"
          aria-label="Název nové zakázky"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {pending ? "Zakládám…" : "Přidat"}
        </button>
      </div>
      <FormError message={state?.error} />
    </form>
  );
}

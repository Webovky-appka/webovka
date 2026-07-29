"use client";

import { MessageKind } from "@prisma/client";
import { useActionState, useRef } from "react";

import { createMessage, type MessageFormState } from "@/app/actions/messages";
import { FormError, inputClasses } from "@/components/field";

const KIND_LABELS: Partial<Record<MessageKind, string>> = {
  NOTE: "Poznámka",
  EMAIL: "E-mail",
  CALL: "Telefonát",
  MEETING: "Schůzka",
};

export function MessageForm({
  clientId,
  projectId,
}: {
  clientId: string;
  projectId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    MessageFormState,
    FormData
  >(async (prevState, formData) => {
    const result = await createMessage(prevState, formData);
    if (!result?.error) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="projectId" value={projectId ?? ""} />

      <textarea
        name="body"
        rows={3}
        required
        placeholder="Co se stalo — o čem jste se domluvili, co jste poslali…"
        className={inputClasses}
      />

      <FormError message={state?.error} />

      <div className="flex flex-wrap items-center gap-2">
        <select
          name="kind"
          defaultValue={MessageKind.NOTE}
          aria-label="Typ záznamu"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Zapsat"}
        </button>
      </div>
    </form>
  );
}

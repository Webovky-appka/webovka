"use client";

import { MessageKind } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";

import { updateMessage, type MessageFormState } from "@/app/actions/messages";
import { FormError, inputClasses } from "@/components/field";

const KIND_LABELS: Partial<Record<MessageKind, string>> = {
  NOTE: "Poznámka",
  EMAIL: "E-mail",
  CALL: "Telefonát",
  MEETING: "Schůzka",
};

export function MessageEditPanel({
  message,
  closeHref,
}: {
  message: { id: string; body: string; kind: MessageKind };
  closeHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    MessageFormState,
    FormData
  >(updateMessage, undefined);

  return (
    <section className="space-y-3 rounded-xl border border-slate-900 bg-white p-4 ring-1 ring-slate-900/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Úprava zápisu</h2>
        <Link
          href={closeHref}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          Zavřít
        </Link>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="messageId" value={message.id} />

        <textarea
          name="body"
          rows={4}
          required
          defaultValue={message.body}
          className={inputClasses}
        />

        <FormError message={state?.error} />

        <div className="flex flex-wrap items-center gap-2">
          <select
            name="kind"
            defaultValue={message.kind}
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
            {pending ? "Ukládám…" : "Uložit zápis"}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          U upraveného zápisu se v historii zobrazí, že byl změněn.
        </p>
      </form>
    </section>
  );
}

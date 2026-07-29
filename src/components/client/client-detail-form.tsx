"use client";

import { useActionState } from "react";

import { updateClient, type ClientFormState } from "@/app/actions/clients";
import { Field, FormError, TextareaField } from "@/components/field";

export function ClientDetailForm({
  client,
}: {
  client: {
    id: string;
    companyName: string;
    contactPerson: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    internalNote: string | null;
  };
}) {
  const [state, formAction, pending] = useActionState<
    ClientFormState,
    FormData
  >(updateClient, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="clientId" value={client.id} />

      <Field
        label="Název firmy"
        name="companyName"
        defaultValue={client.companyName}
        required
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Kontaktní osoba"
          name="contactPerson"
          defaultValue={client.contactPerson}
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={client.email}
        />
        <Field label="Telefon" name="phone" defaultValue={client.phone} />
        <Field
          label="Web"
          name="website"
          defaultValue={client.website}
          placeholder="https://"
        />
      </div>

      <TextareaField
        label="Interní poznámky"
        name="internalNote"
        defaultValue={client.internalNote}
        rows={4}
        hint="Klient tuto poznámku nikdy neuvidí."
      />

      <FormError message={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Ukládám…" : "Uložit změny"}
      </button>
    </form>
  );
}

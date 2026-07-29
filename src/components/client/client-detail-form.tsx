"use client";

import { ClientStatus } from "@prisma/client";
import { useActionState } from "react";

import { updateClient, type ClientFormState } from "@/app/actions/clients";
import { Field, FormError, TextareaField } from "@/components/field";

const STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Poptávka",
  ACTIVE: "Aktivní",
  DONE: "Dokončeno",
  ARCHIVED: "Archiv",
};

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
    status: ClientStatus;
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

      <div className="space-y-1.5">
        <label
          htmlFor="status"
          className="block text-sm font-medium text-slate-700"
        >
          Stav klienta
        </label>
        <select
          id="status"
          name="status"
          defaultValue={client.status}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 sm:w-56"
        >
          {Object.values(ClientStatus).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Archiv klienta skryje z přehledů, data zůstanou zachovaná.
        </p>
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

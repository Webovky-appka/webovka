"use client";

import Link from "next/link";
import { useActionState } from "react";

import { createClient, type ClientFormState } from "@/app/actions/clients";
import { Field, FormError, TextareaField } from "@/components/field";

export function NewClientForm() {
  const [state, formAction, pending] = useActionState<
    ClientFormState,
    FormData
  >(createClient, undefined);

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Klient</h2>
        <Field label="Název firmy" name="companyName" required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kontaktní osoba" name="contactPerson" />
          <Field label="E-mail" name="email" type="email" />
          <Field label="Telefon" name="phone" />
          <Field label="Web" name="website" placeholder="https://" />
          <Field label="IČO" name="ico" hint="Do smlouvy o dílo." />
          <Field
            label="Sídlo"
            name="address"
            placeholder="ulice, město, PSČ"
          />
        </div>
        <TextareaField
          label="Interní poznámky"
          name="internalNote"
          rows={3}
          hint="Klient tuto poznámku nikdy neuvidí."
        />
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">První zakázka</h2>
        <Field
          label="Název zakázky"
          name="projectName"
          required
          placeholder="Nový web"
          hint="Úkoly se předvyplní ze šablony podle fází."
        />
      </div>

      <FormError message={state?.error} />

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Zakládám…" : "Založit klienta"}
        </button>
        <Link
          href="/clients"
          className="text-sm text-slate-600 transition hover:text-slate-900"
        >
          Zrušit
        </Link>
      </div>
    </form>
  );
}

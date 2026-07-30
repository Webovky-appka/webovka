"use client";

import { useActionState } from "react";

import { updateStudioProfile, type StudioState } from "@/app/actions/studio";
import { Field, FormError } from "@/components/field";

export type StudioProfileValues = {
  name: string | null;
  ico: string | null;
  dic: string | null;
  address: string | null;
  bankAccount: string | null;
  representedBy: string | null;
};

/**
 * Naše údaje do smluv. Co je tady, přebíjí proměnné prostředí STUDIO_* —
 * ať se kvůli změně IČA nemusí nasazovat aplikace.
 */
export function StudioProfileForm({
  profile,
  fallbackName,
}: {
  profile: StudioProfileValues | null;
  fallbackName: string;
}) {
  const [state, formAction, pending] = useActionState<StudioState, FormData>(
    updateStudioProfile,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Název nebo firma"
        name="name"
        defaultValue={profile?.name}
        placeholder={fallbackName}
        hint="Včetně právní formy, například Studio s.r.o."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="IČO" name="ico" defaultValue={profile?.ico} />
        <Field
          label="DIČ"
          name="dic"
          defaultValue={profile?.dic}
          hint="Nechte prázdné, pokud nejste plátce DPH."
        />
      </div>

      <Field
        label="Sídlo"
        name="address"
        defaultValue={profile?.address}
        placeholder="ulice a číslo, město, PSČ"
      />

      <Field
        label="Bankovní spojení"
        name="bankAccount"
        defaultValue={profile?.bankAccount}
        placeholder="číslo účtu nebo IBAN"
        hint="Objeví se ve smlouvě jako účet pro platby."
      />

      <Field
        label="Smlouvu podepisuje"
        name="representedBy"
        defaultValue={profile?.representedBy}
        placeholder={fallbackName}
      />

      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.success}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Ukládám…" : "Uložit údaje"}
      </button>
    </form>
  );
}

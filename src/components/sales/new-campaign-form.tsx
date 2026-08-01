"use client";

import { useActionState } from "react";

import { createCampaign, type SalesFormState } from "@/app/actions/sales";
import { Field, FormError, TextareaField } from "@/components/field";

/**
 * Založení kampaně. Mise je povinná od začátku — kampaň bez obchodního cíle
 * by Scout neměl vůbec spouštět.
 */
export function NewCampaignForm() {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    createCampaign,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <Field
        label="Název kampaně"
        name="name"
        required
        placeholder="Restaurace Brno — srpen"
      />

      <TextareaField
        label="Mise"
        name="mission"
        rows={4}
        placeholder="Například: Hledej nezávislé restaurace v Brně a okolí se silným hodnocením, ale zastaralým webem. Upřednostni podniky, kde jsou důležité fotografie a online rezervace. Najdi nejvýš 10 kvalitních příležitostí."
        hint="Co má tým hledat a proč. Mění se podle potřeby, identitu agentů drží prompty níž."
      />

      <FormError message={state?.error} />

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Zakládám…" : "Založit kampaň"}
      </button>
    </form>
  );
}

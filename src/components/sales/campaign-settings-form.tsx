"use client";

import { useActionState } from "react";

import { updateCampaign, type SalesFormState } from "@/app/actions/sales";
import { Field, FormError, TextareaField } from "@/components/field";
import { inputClasses } from "@/components/field";

export type CampaignSettings = {
  id: string;
  name: string;
  mission: string;
  segment: string | null;
  geography: string | null;
  dailyLimit: number;
  minScore: number;
};

function NumberField({
  label,
  name,
  defaultValue,
  hint,
}: {
  label: string;
  name: string;
  defaultValue: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        min={0}
        defaultValue={defaultValue}
        className={`${inputClasses} max-w-40`}
      />
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function CampaignSettingsForm({ campaign }: { campaign: CampaignSettings }) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    updateCampaign,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="campaignId" value={campaign.id} />

      <Field label="Název" name="name" defaultValue={campaign.name} required />

      <TextareaField
        label="Mise"
        name="mission"
        defaultValue={campaign.mission}
        rows={5}
        hint="Dnešní obchodní cíl týmu. Mění se bez nasazení, od příštího běhu."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Segment"
          name="segment"
          defaultValue={campaign.segment}
          placeholder="restaurace, řemeslníci, ordinace…"
        />
        <Field
          label="Oblast"
          name="geography"
          defaultValue={campaign.geography}
          placeholder="Brno a okolí"
        />
        <NumberField
          label="Denní limit leadů"
          name="dailyLimit"
          defaultValue={campaign.dailyLimit}
          hint="Nejvýš tolik kvalifikovaných leadů z jednoho běhu."
        />
        <NumberField
          label="Minimální skóre"
          name="minScore"
          defaultValue={campaign.minScore}
          hint="Lead pod tímhle skóre se rovnou zamítne."
        />
      </div>

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
        {pending ? "Ukládám…" : "Uložit kampaň"}
      </button>
    </form>
  );
}

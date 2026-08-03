"use client";

import { useActionState } from "react";

import { createCampaign, type SalesFormState } from "@/app/actions/sales";
import { Field, FormError, TextareaField } from "@/components/field";
import { inputClasses } from "@/components/field";

/**
 * Založení kampaně s kompletním nastavením — limit, práh i rozvrh se zadají
 * hned, ne až dodatečně v nastavení. Mise je povinná od začátku — kampaň bez
 * obchodního cíle by Scout neměl vůbec spouštět.
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
        hint="Co má tým hledat a proč. Mění se podle potřeby, identitu agentů drží prompty v detailu kampaně."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Segment"
          name="segment"
          placeholder="restaurace, řemeslníci, ordinace…"
        />
        <Field label="Oblast" name="geography" placeholder="Brno a okolí" />
        <div className="space-y-1.5">
          <label
            htmlFor="new-dailyLimit"
            className="block text-sm font-medium text-slate-700"
          >
            Denní limit příležitostí
          </label>
          <input
            id="new-dailyLimit"
            name="dailyLimit"
            type="number"
            min={1}
            max={50}
            defaultValue={8}
            className={`${inputClasses} max-w-40`}
          />
          <p className="text-xs text-slate-500">
            Nejvýš tolik kvalifikovaných příležitostí z jednoho běhu.
          </p>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="new-minScore"
            className="block text-sm font-medium text-slate-700"
          >
            Minimální skóre
          </label>
          <input
            id="new-minScore"
            name="minScore"
            type="number"
            min={0}
            max={100}
            defaultValue={60}
            className={`${inputClasses} max-w-40`}
          />
          <p className="text-xs text-slate-500">
            Příležitost pod tímto skóre se rovnou zamítne.
          </p>
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="new-schedule"
            className="block text-sm font-medium text-slate-700"
          >
            Automatické spouštění
          </label>
          <select
            id="new-schedule"
            name="schedule"
            defaultValue="NONE"
            className={`${inputClasses} max-w-56`}
          >
            <option value="NONE">Jen ručně</option>
            <option value="WEEKDAYS">Každý pracovní den ráno</option>
            <option value="DAILY">Každý den ráno</option>
          </select>
          <p className="text-xs text-slate-500">
            Běh startuje kolem 8:00. Ráno pak čekají příležitosti ke schválení.
          </p>
        </div>
      </div>

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

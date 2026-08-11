"use client";

import { useActionState } from "react";

import { rateWebsite, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";
import { gradeFor, HUMAN_GRADES } from "@/lib/sales/human-grades";

/**
 * Vaše hodnocení webu vedle snímků. Neovlivňuje skóre téhle příležitosti —
 * učí příští audity, kde má člověk laťku.
 *
 * Známky jsou radia s jedním tlačítkem Uložit, ne sedm submitů: s tlačítky
 * stačilo zmáčknout Enter v poli poznámky a uložila se první z nich
 * (Katastrofa), protože implicitní odeslání bere první submit ve formuláři.
 */
export function RateWebsite({
  leadId,
  humanScore,
  humanNote,
  active,
  modelScore,
}: {
  leadId: string;
  humanScore: number | null;
  humanNote: string | null;
  active: boolean;
  modelScore: number | null;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    rateWebsite,
    undefined,
  );
  // Hodnocení z dřívější, hrubší škály se má poznat u nejbližšího stupně.
  const selected = humanScore === null ? null : gradeFor(humanScore).score;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Vaše hodnocení webu
        </span>
        {HUMAN_GRADES.map((grade) => (
          <label
            key={grade.score}
            title={grade.hint}
            className="cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 has-checked:border-sky-300 has-checked:bg-sky-50 has-checked:font-medium has-checked:text-sky-900"
          >
            <input
              type="radio"
              name="score"
              value={grade.score}
              defaultChecked={selected === grade.score}
              className="sr-only"
            />
            {grade.label} ({grade.score})
          </label>
        ))}
      </div>

      <input
        type="text"
        name="note"
        maxLength={200}
        defaultValue={humanNote ?? ""}
        placeholder="Nepovinně: čím si tu známku vysloužil (jedna věta pro model)"
        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Uložit hodnocení"}
        </button>
        {humanScore !== null ? (
          <span className="text-xs text-slate-400">
            uloženo: {gradeFor(humanScore).label} ({humanScore})
            {modelScore !== null ? ` · model dal ${modelScore}` : ""}
            {active ? "" : " · vypnuto pro kalibraci"}
          </span>
        ) : null}
      </div>

      <p className="text-xs text-slate-400">
        Kalibruje příští audity — model dostane vaše ohodnocené weby napříč
        škálou jako vzor. Celou sbírku spravujete v Nastavení.
      </p>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

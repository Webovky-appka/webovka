"use client";

import { useActionState } from "react";

import { rateWebsite, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";
import { gradeFor, HUMAN_GRADES } from "@/lib/sales/human-grades";

/**
 * Vaše hodnocení webu vedle snímků. Neovlivňuje skóre téhle příležitosti —
 * učí příští audity, kde má člověk laťku.
 */
export function RateWebsite({
  leadId,
  humanScore,
  modelScore,
}: {
  leadId: string;
  humanScore: number | null;
  modelScore: number | null;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    rateWebsite,
    undefined,
  );
  // Hodnocení z dřívější, hrubší škály se má poznat u nejbližšího stupně.
  const activeScore = humanScore === null ? null : gradeFor(humanScore).score;

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Vaše hodnocení webu
        </span>
        {HUMAN_GRADES.map((grade) => {
          const active = activeScore === grade.score;
          return (
            <button
              key={grade.score}
              type="submit"
              name="score"
              value={grade.score}
              disabled={pending}
              title={grade.hint}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition disabled:opacity-60 ${
                active
                  ? "border-sky-300 bg-sky-50 font-medium text-sky-900"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {grade.label} ({grade.score})
            </button>
          );
        })}
        {humanScore !== null && modelScore !== null ? (
          <span className="text-xs text-slate-400">
            vy {humanScore} · model {modelScore}
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        <input
          type="text"
          name="note"
          maxLength={200}
          placeholder="Nepovinně: čím si tu známku vysloužil (jedna věta pro model)"
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
        />
        <p className="text-xs text-slate-400">
          Kalibruje příští audity — model dostane vaše ohodnocené weby napříč
          škálou jako vzor. Celou sbírku najdete v Nastavení.
        </p>
      </div>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}

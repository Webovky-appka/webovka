"use client";

import { useActionState } from "react";

import { rateWebsite, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";

/** Známky majitele studia — mapují se na škálu kvality webu 0–100. */
export const HUMAN_GRADES = [
  { score: 30, label: "Zastaralý" },
  { score: 55, label: "Průměrný" },
  { score: 75, label: "Dobrý" },
  { score: 90, label: "Špičkový" },
] as const;

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

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Vaše hodnocení webu
        </span>
        {HUMAN_GRADES.map((grade) => {
          const active = humanScore === grade.score;
          return (
            <button
              key={grade.score}
              type="submit"
              name="score"
              value={grade.score}
              disabled={pending}
              className={`rounded-lg border px-3 py-1.5 text-xs transition disabled:opacity-60 ${
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
      <p className="text-xs text-slate-400">
        Kalibruje příští audity — model dostane vaše poslední ohodnocené weby
        jako vzor.
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

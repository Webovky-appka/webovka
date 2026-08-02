"use client";

import { useActionState, useState } from "react";

import { setLeadOutcome, type SalesFormState } from "@/app/actions/sales";
import { FormError } from "@/components/field";
import { LOST_REASONS } from "@/lib/sales/funnel";

const OPTIONS: { value: string; label: string }[] = [
  { value: "REPLIED", label: "Odpověděl" },
  { value: "MEETING", label: "Schůzka" },
  { value: "PROPOSAL", label: "Nabídka" },
  { value: "WON", label: "Vyhráno" },
  { value: "LOST", label: "Prohráno" },
];

/**
 * Ruční posun leadu po oslovení. Každý lead má skončit výsledkem — bez
 * outcomes nejde nikdy říct, které kampaně a e-maily fungují.
 */
export function OutcomePanel({
  leadId,
  status,
}: {
  leadId: string;
  status: string;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    setLeadOutcome,
    undefined,
  );
  const [losing, setLosing] = useState(false);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Co se stalo dál</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Zapisujte výsledky — z nich se počítá reply rate a jednou se z nich
          bude učit Coach.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="leadId" value={leadId} />

        <div className="flex flex-wrap gap-2">
          {OPTIONS.map((option) =>
            option.value === "LOST" ? (
              <button
                key={option.value}
                type="button"
                onClick={() => setLosing((value) => !value)}
                className={`rounded-lg border px-3.5 py-2 text-sm transition ${
                  losing
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                Prohráno…
              </button>
            ) : (
              <button
                key={option.value}
                type="submit"
                name="outcome"
                value={option.value}
                disabled={pending || option.value === status}
                className={`rounded-lg border px-3.5 py-2 text-sm transition disabled:opacity-50 ${
                  option.value === "WON"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ),
          )}
        </div>

        {losing ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3">
            <select
              name="lostReason"
              aria-label="Důvod prohry"
              className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-400"
            >
              {LOST_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <button
              type="submit"
              name="outcome"
              value="LOST"
              disabled={pending}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Ukládám…" : "Potvrdit prohru"}
            </button>
          </div>
        ) : null}

        <FormError message={state?.error} />
        {state?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.success}
          </p>
        ) : null}
      </form>
    </section>
  );
}

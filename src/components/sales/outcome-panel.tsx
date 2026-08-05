"use client";

import { useActionState, useState } from "react";

import {
  foundProjectFromLead,
  setLeadOutcome,
  type SalesFormState,
} from "@/app/actions/sales";
import { FormError } from "@/components/field";
import { LOST_REASONS } from "@/lib/sales/funnel";

/** Mezikroky po oslovení — volné přepínání oběma směry. */
const STEPS: { value: string; label: string; hint: string }[] = [
  {
    value: "REPLIED",
    label: "Odpověděli nám",
    hint: "firma na e-mail zareagovala",
  },
  {
    value: "MEETING",
    label: "Máme schůzku",
    hint: "domluvený termín hovoru nebo setkání",
  },
  {
    value: "PROPOSAL",
    label: "Poslali jsme nabídku",
    hint: "čeká se na rozhodnutí firmy",
  },
];

/**
 * Co se stalo po odeslání e-mailu. Mezikroky se dají kdykoli přepnout nebo
 * odvolat (zpět na Oslovená); konec je buď založená zakázka, nebo prohra
 * s důvodem.
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
  const [founded, foundAction, founding] = useActionState<
    SalesFormState,
    FormData
  >(foundProjectFromLead, undefined);
  const [losing, setLosing] = useState(false);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Co se stalo dál?
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Zaznamenejte, jak jednání pokračuje. Všechno jde kdykoli přepnout
          nebo vzít zpět.
        </p>
      </div>

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <ul className="space-y-1.5">
          {STEPS.map((step) => {
            const active = step.value === status;
            return (
              <li key={step.value}>
                <button
                  type="submit"
                  name="outcome"
                  value={step.value}
                  disabled={pending || active}
                  className={`flex w-full items-baseline justify-between gap-3 rounded-lg border px-3.5 py-2 text-left text-sm transition disabled:cursor-default ${
                    active
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{step.label}</span>
                  <span
                    className={`text-xs ${active ? "text-sky-700" : "text-slate-400"}`}
                  >
                    {active ? "aktuální stav" : step.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {status !== "CONTACTED" ? (
          <button
            type="submit"
            name="outcome"
            value="CONTACTED"
            disabled={pending}
            className="text-xs text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-60"
          >
            ↩ Vzít zpět — vrátit na „Oslovená, bez odpovědi“
          </button>
        ) : null}

        <FormError message={state?.error} />
        {state?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.success}
          </p>
        ) : null}
      </form>

      <hr className="border-slate-100" />

      <div className="flex flex-wrap items-start gap-3">
        <form action={foundAction}>
          <input type="hidden" name="leadId" value={leadId} />
          <button
            type="submit"
            disabled={founding}
            className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {founding ? "Zakládám… dohledávám IČO" : "Vyhráno — založit zakázku"}
          </button>
          <p className="mt-1 max-w-64 text-xs text-slate-500">
            Založí klienta i zakázku ze známých údajů; IČO a sídlo zkusí
            dohledat AI.
          </p>
          <FormError message={founded?.error} />
        </form>

        <form action={formAction} className="min-w-0 flex-1">
          <input type="hidden" name="leadId" value={leadId} />
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
              <button
                type="button"
                onClick={() => setLosing(false)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                zrušit
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setLosing(true)}
              className="rounded-lg border border-red-200 px-3.5 py-2 text-sm text-red-700 transition hover:bg-red-50"
            >
              Prohráno…
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

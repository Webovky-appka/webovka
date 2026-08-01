"use client";

import { useActionState } from "react";

import {
  approveAndSendEmail,
  markEmailSentManually,
  rejectLead,
  saveEmailDraft,
  type SalesFormState,
} from "@/app/actions/sales";
import { Field, FormError, inputClasses } from "@/components/field";
import { STRATEGY_LABELS, isOutreachStrategy } from "@/lib/sales/outreach-input";

const primaryButton =
  "rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

/**
 * Schvalovací obrazovka (sekce 14 specifikace). Jediné místo, kudy cold
 * e-mail odchází — a vždy až po kliknutí člověka. Odesílá se přesně to,
 * co je v políčkách.
 */
export function ReviewPanel({
  draft,
  leadId,
  defaultTo,
  gmailAddress,
}: {
  draft: { id: string; subject: string; body: string; strategy: string | null };
  leadId: string;
  defaultTo: string;
  gmailAddress: string | null;
}) {
  const [saved, saveAction, saving] = useActionState<SalesFormState, FormData>(
    saveEmailDraft,
    undefined,
  );
  const [sent, sendAction, sending] = useActionState<SalesFormState, FormData>(
    approveAndSendEmail,
    undefined,
  );
  const [marked, markAction, marking] = useActionState<
    SalesFormState,
    FormData
  >(markEmailSentManually, undefined);
  const [rejected, rejectAction, rejecting] = useActionState<
    SalesFormState,
    FormData
  >(rejectLead, undefined);

  const feedback = sent ?? marked ?? saved;

  return (
    <section className="space-y-4 rounded-xl border border-emerald-300 bg-white p-5 ring-1 ring-emerald-100">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Návrh e-mailu ke schválení
        </h2>
        {draft.strategy && isOutreachStrategy(draft.strategy) ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {STRATEGY_LABELS[draft.strategy]}
          </span>
        ) : null}
      </div>

      <form id={`review-${draft.id}`} action={sendAction} className="space-y-4">
        <input type="hidden" name="draftId" value={draft.id} />

        <Field
          label="Komu"
          name="to"
          type="email"
          defaultValue={defaultTo}
          hint={
            defaultTo === ""
              ? "Kontakt se nedohledal — adresu doplňte ručně, uloží se k firmě."
              : undefined
          }
        />

        <Field label="Předmět" name="subject" defaultValue={draft.subject} />

        <div className="space-y-1.5">
          <label
            htmlFor="body"
            className="block text-sm font-medium text-slate-700"
          >
            Text e-mailu
          </label>
          <textarea
            id="body"
            name="body"
            rows={12}
            defaultValue={draft.body}
            className={inputClasses}
          />
        </div>

        <FormError message={feedback?.error} />
        {feedback?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {feedback.success}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={sending} className={primaryButton}>
            {sending
              ? "Odesílám…"
              : gmailAddress
                ? `Schválit a odeslat z ${gmailAddress}`
                : "Schválit a odeslat"}
          </button>

          <button
            type="submit"
            formAction={saveAction}
            disabled={saving}
            className={secondaryButton}
          >
            {saving ? "Ukládám…" : "Uložit úpravy"}
          </button>

          <button
            type="submit"
            formAction={markAction}
            disabled={marking}
            className={secondaryButton}
            title="Když e-mail odešlete jinou cestou — jen přepne stavy."
          >
            {marking ? "Ukládám…" : "Označit jako odeslaný"}
          </button>
        </div>

        {!gmailAddress ? (
          <p className="text-xs text-amber-700">
            Gmail není napojený — Schválit a odeslat poradí, ať ho napojíte
            v Nastavení, nebo použijte Označit jako odeslaný.
          </p>
        ) : null}
      </form>

      <hr className="border-slate-100" />

      <form action={rejectAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="leadId" value={leadId} />
        <input
          name="reason"
          placeholder="Důvod zamítnutí (nepovinné)"
          aria-label="Důvod zamítnutí"
          className="min-w-56 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          disabled={rejecting}
          className="rounded-lg border border-red-200 px-3.5 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-60"
        >
          {rejecting ? "Zamítám…" : "Zamítnout lead"}
        </button>
        <FormError message={rejected?.error} />
      </form>
    </section>
  );
}

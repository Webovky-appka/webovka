"use client";

import { useActionState } from "react";

import {
  approveAndSendEmail,
  markEmailSentManually,
  refineEmailDraft,
  rejectLead,
  saveEmailDraft,
  undoDraftRevision,
  type SalesFormState,
} from "@/app/actions/sales";
import { formatDateTime } from "@/lib/format";
import { MAX_INSTRUCTION_CHARS } from "@/lib/sales/outreach-input";
import { Field, FormError, inputClasses } from "@/components/field";
import {
  STRATEGY_LABELS,
  isOutreachStrategy,
} from "@/lib/sales/outreach-input";

const primaryButton =
  "rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60";
const secondaryButton =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

/**
 * Schvalovací obrazovka (sekce 14 specifikace). Jediné místo, kudy cold
 * e-mail odchází — a vždy až po kliknutí člověka. Odesílá se přesně to,
 * co je v políčkách.
 */
export type DraftRevision = {
  id: string;
  instruction: string | null;
  createdAt: Date;
};

export function ReviewPanel({
  draft,
  revisions,
  leadId,
  defaultTo,
  gmailAddress,
}: {
  draft: { id: string; subject: string; body: string; strategy: string | null };
  /** Historie od nejnovější — první je ta, na kterou vrátí tlačítko Zpět. */
  revisions: DraftRevision[];
  leadId: string;
  defaultTo: string;
  gmailAddress: string | null;
}) {
  const [undone, undoAction, undoing] = useActionState<
    SalesFormState,
    FormData
  >(undoDraftRevision, undefined);
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
  const [refined, refineAction, refining] = useActionState<
    SalesFormState,
    FormData
  >(refineEmailDraft, undefined);

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

      {/* Klíč podle obsahu: po úpravě AI se políčka přemontují s novým
          textem — defaultValue se jinak po hydrataci už nemění. */}
      <form
        key={draft.subject + draft.body}
        id={`review-${draft.id}`}
        action={sendAction}
        className="space-y-4"
      >
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
            Gmail není napojený — Schválit a odeslat poradí, ať ho napojíte v
            Nastavení, nebo použijte Označit jako odeslaný.
          </p>
        ) : null}
      </form>

      <hr className="border-slate-100" />

      <form action={refineAction} className="space-y-2">
        <input type="hidden" name="draftId" value={draft.id} />
        <input type="hidden" name="leadId" value={leadId} />
        <div className="flex flex-wrap items-start gap-2">
          {/* Textarea, ne input: dlouhý pokyn musí být vidět celý, ne po
              jednom řádku. Roste s textem až do rozumné výšky. */}
          <textarea
            name="instruction"
            rows={2}
            maxLength={MAX_INSTRUCTION_CHARS}
            onInput={(event) => {
              const el = event.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 400)}px`;
            }}
            placeholder="Pokyn pro AI — např.: přátelštější tón, zmiň letní sezónu, zkrať to. Klidně napište celý odstavec."
            aria-label="Pokyn pro úpravu e-mailu"
            className="field-sizing-content min-h-16 min-w-56 flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          <button
            type="submit"
            disabled={refining}
            className={secondaryButton}
            title="AI přepíše návrh podle pokynu. Nic se neodesílá."
          >
            {refining ? "Upravuji…" : "Upravit AI"}
          </button>
        </div>
        <FormError message={refined?.error} />
        {refined?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {refined.success}
          </p>
        ) : null}
      </form>

      {revisions.length > 0 ? (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Historie úprav ({revisions.length})
            </p>
            <form action={undoAction}>
              <input type="hidden" name="draftId" value={draft.id} />
              <button
                type="submit"
                disabled={undoing}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {undoing ? "Vracím…" : "↩ Zpět o krok"}
              </button>
            </form>
          </div>
          <ol className="space-y-1 text-xs text-slate-600">
            {revisions.map((revision, index) => (
              <li key={revision.id} className="flex flex-wrap gap-x-2">
                <span className="text-slate-400">
                  {index === 0 ? "naposledy" : `o ${index + 1} kroky zpět`}
                </span>
                <span className="min-w-0">
                  {revision.instruction
                    ? `„${revision.instruction}“`
                    : "ruční úprava textu"}
                </span>
                <span className="text-slate-400">
                  {formatDateTime(revision.createdAt)}
                </span>
              </li>
            ))}
          </ol>
          <FormError message={undone?.error} />
          {undone?.success ? (
            <p className="text-xs text-emerald-700">{undone.success}</p>
          ) : null}
        </div>
      ) : null}

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
          {rejecting ? "Zamítám…" : "Zamítnout příležitost"}
        </button>
        <FormError message={rejected?.error} />
      </form>
    </section>
  );
}

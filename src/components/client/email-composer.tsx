"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  composeEmail,
  deliverEmail,
  type EmailState,
} from "@/app/actions/email";
import { FormError, inputClasses } from "@/components/field";

/** Kus zadání pro model. Jen ke čtení — do API jde přesně tenhle text. */
function PromptBlock({
  title,
  text,
}: {
  title: string;
  text: string | undefined;
}) {
  if (!text) return null;

  return (
    <details className="rounded border border-slate-200 bg-white">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-slate-600">
        {title}
      </summary>
      <pre className="max-h-64 overflow-auto border-t border-slate-100 px-2.5 py-2 text-xs whitespace-pre-wrap text-slate-700">
        {text}
      </pre>
    </details>
  );
}

const TONE_OPTIONS = [
  { value: "formal", label: "Formální" },
  { value: "friendly", label: "Přátelský" },
  { value: "short", label: "Krátký a věcný" },
];

const buttonClasses =
  "rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60";
const secondaryClasses =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

/**
 * Napsání e-mailu klientovi. Návrh složí model z podkladů o zakázce, text
 * zůstane k ruční úpravě a odeslání jde přes Gmail přihlášeného uživatele.
 *
 * Políčka s předmětem a textem jsou obyčejná, neřízená — jen se přemountují,
 * když dorazí nový návrh. Ruční úpravy tak nepřepíše překreslení stránky.
 */
export function EmailComposer({
  projectId,
  projectName,
  clientEmail,
  gmailAddress,
  aiReady,
  aiModel,
}: {
  projectId: string;
  projectName: string;
  clientEmail: string | null;
  gmailAddress: string | null;
  aiReady: boolean;
  aiModel: string;
}) {
  const [draft, draftAction, drafting] = useActionState<EmailState, FormData>(
    composeEmail,
    undefined,
  );
  const [delivery, deliveryAction, delivering] = useActionState<
    EmailState,
    FormData
  >(deliverEmail, undefined);

  const [mode, setMode] = useState<"context" | "draft">("draft");

  // Nový návrh se pozná podle obsahu, takže přepíše políčka jen když se opravdu
  // změnil. Vlastní úpravy zůstanou.
  const draftKey = `${draft?.subject ?? ""}|${(draft?.body ?? "").length}`;

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Napsat e-mail klientovi
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {aiReady
            ? `Návrh složí model ${aiModel} z podkladů o zakázce ${projectName}. Podklady se posílají do OpenAI — můžete si je před tím zobrazit.`
            : "Bez klíče OPENAI_API_KEY vznikne návrh ze šablony a nikam se nic neposílá."}
        </p>
      </div>

      <form action={draftAction} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />

        <div className="space-y-1.5">
          <label
            htmlFor="instruction"
            className="block text-sm font-medium text-slate-700"
          >
            Co má e-mail říct
          </label>
          <textarea
            id="instruction"
            name="instruction"
            rows={3}
            placeholder="Například: pošli klientovi odkaz na hotový návrh homepage a poproš ho o schválení do konce týdne."
            className={inputClasses}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="tone"
              className="block text-sm font-medium text-slate-700"
            >
              Tón
            </label>
            <select
              id="tone"
              name="tone"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {TONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="includeInternal"
              className="size-4 rounded border-slate-300"
            />
            Přidat i interní poznámku o klientovi
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="mode"
            value="draft"
            onClick={() => setMode("draft")}
            disabled={drafting}
            className={buttonClasses}
          >
            {drafting && mode === "draft" ? "Skládám návrh…" : "Vytvořit návrh"}
          </button>
          <button
            type="submit"
            name="mode"
            value="context"
            onClick={() => setMode("context")}
            disabled={drafting}
            className={secondaryClasses}
          >
            {drafting && mode === "context" ? "Načítám…" : "Načíst podklady"}
          </button>
        </div>

        <FormError message={draft?.error} />

        {draft?.source === "template" ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Návrh je ze šablony, zadání se nepoužilo.
          </p>
        ) : null}
      </form>

      {draft?.promptUser ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-700">
            Zadání pro model
            <span className="font-normal text-slate-500">
              {draft.contextSent
                ? " — přesně toto odešlo do OpenAI"
                : " — takto by to odešlo, teď se nikam neposlalo"}
            </span>
          </p>
          <p className="text-xs text-slate-500">
            Upravit to nejde, skládá aplikace. Zadání níž ovlivníte políčkem
            „Co má e-mail říct“ a tónem.
          </p>

          <PromptBlock title="Pravidla pro model" text={draft.promptSystem} />
          <PromptBlock title="Podklady a zadání" text={draft.promptUser} />
        </div>
      ) : null}

      <hr className="border-slate-100" />

      <form action={deliveryAction} className="space-y-3">
        <input type="hidden" name="projectId" value={projectId} />

        <div className="space-y-1.5">
          <label
            htmlFor="to"
            className="block text-sm font-medium text-slate-700"
          >
            Komu
          </label>
          <input
            id="to"
            name="to"
            type="email"
            defaultValue={clientEmail ?? ""}
            placeholder="adresa@klienta.cz"
            className={inputClasses}
          />
          {clientEmail === null ? (
            <p className="text-xs text-amber-700">
              Klient nemá u sebe uloženou adresu, doplňte ji ručně.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="subject"
            className="block text-sm font-medium text-slate-700"
          >
            Předmět
          </label>
          <input
            key={`subject-${draftKey}`}
            id="subject"
            name="subject"
            defaultValue={draft?.subject ?? ""}
            className={inputClasses}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="body"
            className="block text-sm font-medium text-slate-700"
          >
            Text e-mailu
          </label>
          <textarea
            key={`body-${draftKey}`}
            id="body"
            name="body"
            rows={14}
            defaultValue={draft?.body ?? ""}
            placeholder="Návrh se objeví tady. Můžete ho přepsat, odešle se přesně to, co je v políčku."
            className={inputClasses}
          />
        </div>

        <FormError message={delivery?.error} />
        {delivery?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {delivery.success}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {gmailAddress ? (
            <button
              type="submit"
              name="mode"
              value="send"
              disabled={delivering}
              className={buttonClasses}
            >
              {delivering ? "Pracuji…" : `Odeslat z ${gmailAddress}`}
            </button>
          ) : (
            <Link href="/settings" className={secondaryClasses}>
              Napojit Gmail v nastavení
            </Link>
          )}

          <button
            type="submit"
            name="mode"
            value="log"
            disabled={delivering}
            className={secondaryClasses}
          >
            Jen zapsat do komunikace
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Odešle se přesně to, co je v políčkách. Odeslaný e-mail se sám zapíše
          do komunikace u klienta.
        </p>
      </form>
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";

import {
  composeContract,
  saveContract,
  type ContractState,
} from "@/app/actions/contracts";
import { CONTRACT_DEFAULTS } from "@/lib/contract-template";
import { FormError, inputClasses } from "@/components/field";

const buttonClasses =
  "rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60";
const secondaryClasses =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

export type ContractProject = {
  id: string;
  label: string;
  phaseCount: number;
};

/** Kus zadání pro model. Jen ke čtení, do API jde přesně tenhle text. */
function PromptBlock({ title, text }: { title: string; text?: string }) {
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

function NumberField({
  label,
  name,
  value,
  onChange,
  hint,
  suffix,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={name}
          name={name}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className={`${inputClasses} max-w-40`}
        />
        {suffix ? (
          <span className="text-sm text-slate-500">{suffix}</span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/**
 * Sestavení smlouvy k zakázce. Text vzniká ze šablony v aplikaci, model ho jen
 * upravuje podle pokynu — tím se nestane, že by z něj zmizela ochranná
 * ustanovení, protože se to modelu zdálo hezčí.
 */
export function ContractBuilder({
  projects,
  selectedId,
  savedBody,
  hasSaved,
  aiReady,
  aiModel,
}: {
  projects: ContractProject[];
  selectedId: string;
  savedBody: string | null;
  hasSaved: boolean;
  aiReady: boolean;
  aiModel: string;
}) {
  const [draft, composeAction, composing] = useActionState<
    ContractState,
    FormData
  >(composeContract, savedBody ? { body: savedBody } : undefined);
  const [saved, saveAction, saving] = useActionState<ContractState, FormData>(
    saveContract,
    undefined,
  );

  const [mode, setMode] = useState<"template" | "ai">("template");
  const [projectId, setProjectId] = useState(selectedId);

  // Parametry musí být v jednom stavu: skládá se z nich text v prvním formuláři
  // a zároveň se ukládají s textem ve druhém. Jinak by se v databázi objevila
  // cena 0, i když ve smlouvě je částka.
  const [values, setValues] = useState({
    totalPrice: 0,
    depositPercent: CONTRACT_DEFAULTS.depositPercent,
    hourlyRate: CONTRACT_DEFAULTS.hourlyRate,
    revisionsPerPhase: CONTRACT_DEFAULTS.revisionsPerPhase,
    paymentDays: CONTRACT_DEFAULTS.paymentDays,
  });

  const set = (key: keyof typeof values) => (value: number) =>
    setValues((current) => ({ ...current, [key]: value }));

  const body = draft?.body ?? savedBody ?? "";
  const project = projects.find((item) => item.id === projectId);

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Podklady smlouvy
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Fáze zakázky se stanou milníky s platbou. Cena se rozdělí na zálohu a
            zbytek rovným dílem mezi fáze.
          </p>
        </div>

        <form action={composeAction} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="projectId"
              className="block text-sm font-medium text-slate-700"
            >
              Zakázka
            </label>
            <select
              id="projectId"
              name="projectId"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              className={inputClasses}
            >
              {projects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {project ? (
              <p className="text-xs text-slate-500">
                {project.phaseCount === 0
                  ? "Zakázka nemá fáze, smlouva bude bez milníků."
                  : `${project.phaseCount} fází, tolik bude i platebních milníků.`}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Cena díla bez DPH"
              name="totalPrice"
              value={values.totalPrice}
              onChange={set("totalPrice")}
              suffix="Kč"
              hint="Celková cena, ze které se počítá záloha i milníky."
            />
            <NumberField
              label="Záloha"
              name="depositPercent"
              value={values.depositPercent}
              onChange={set("depositPercent")}
              suffix="%"
              hint="Platí se při podpisu, práce začínají po zaplacení."
            />
            <NumberField
              label="Hodinová sazba nad rámec"
              name="hourlyRate"
              value={values.hourlyRate}
              onChange={set("hourlyRate")}
              suffix="Kč"
            />
            <NumberField
              label="Kol úprav v ceně na fázi"
              name="revisionsPerPhase"
              value={values.revisionsPerPhase}
              onChange={set("revisionsPerPhase")}
            />
            <NumberField
              label="Splatnost faktur"
              name="paymentDays"
              value={values.paymentDays}
              onChange={set("paymentDays")}
              suffix="dnů"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="instruction"
              className="block text-sm font-medium text-slate-700"
            >
              Co má model ve smlouvě změnit
            </label>
            <textarea
              id="instruction"
              name="instruction"
              rows={3}
              placeholder="Například: přidej odstavec o mlčenlivosti a zkrať článek o ukončení smlouvy."
              className={inputClasses}
            />
            <p className="text-xs text-slate-500">
              {aiReady
                ? `Upraví ${aiModel}. Text smlouvy se posílá do OpenAI, prompt je vidět níž.`
                : "Bez OPENAI_API_KEY se smlouva jen složí ze šablony."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="mode"
              value="template"
              onClick={() => setMode("template")}
              disabled={composing}
              className={buttonClasses}
            >
              {composing && mode === "template"
                ? "Skládám…"
                : "Složit ze šablony"}
            </button>
            <button
              type="submit"
              name="mode"
              value="ai"
              onClick={() => setMode("ai")}
              disabled={composing || !aiReady}
              className={secondaryClasses}
            >
              {composing && mode === "ai" ? "Upravuji…" : "Upravit modelem"}
            </button>
          </div>

          <FormError message={draft?.error} />
        </form>

        {draft?.promptUser ? (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-700">
              Zadání pro model
              <span className="font-normal text-slate-500">
                {draft.sentToAi
                  ? " — přesně toto odešlo do OpenAI"
                  : " — takto by to odešlo, teď se nikam neposlalo"}
              </span>
            </p>
            <PromptBlock title="Pravidla pro model" text={draft.promptSystem} />
            <PromptBlock title="Smlouva a pokyn" text={draft.promptUser} />
          </div>
        ) : null}
      </section>

      <form
        action={saveAction}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"
      >
        <input type="hidden" name="projectId" value={projectId} />
        {Object.entries(values).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}

        <div>
          <h2 className="text-sm font-semibold text-slate-900">Text smlouvy</h2>
          <p className="mt-1 text-xs text-slate-500">
            Můžete do něj psát přímo. Ukládá se přesně to, co je v políčku, a
            Word se dělá z uloženého textu.
          </p>
        </div>

        <textarea
          key={body.slice(0, 40) + body.length}
          name="body"
          rows={26}
          defaultValue={body}
          placeholder="Smlouva se objeví tady, až ji složíte ze šablony."
          className={`${inputClasses} font-mono text-xs`}
        />

        <FormError message={saved?.error} />
        {saved?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saved.success}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={saving || body === ""}
            className={buttonClasses}
          >
            {saving ? "Ukládám…" : "Uložit smlouvu"}
          </button>

          {hasSaved || saved?.success ? (
            <a href={`/api/contracts/${projectId}`} className={secondaryClasses}>
              Stáhnout Word
            </a>
          ) : (
            <span className="text-xs text-slate-500">
              Word se stáhne po uložení.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

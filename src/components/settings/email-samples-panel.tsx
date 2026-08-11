"use client";

import { useActionState, useState } from "react";

import {
  deleteEmailSample,
  saveEmailSample,
  toggleEmailSample,
  type SalesFormState,
} from "@/app/actions/sales";
import { FormError } from "@/components/field";
import { MAX_SAMPLES } from "@/lib/sales/email-samples";

export type EmailSampleItem = {
  id: string;
  label: string;
  subject: string | null;
  body: string;
  note: string | null;
  active: boolean;
};

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400";

/** Formulář pro nový i editovaný vzor — stejná pravidla pro obojí. */
function SampleForm({
  sample,
  onDone,
}: {
  sample?: EmailSampleItem;
  onDone?: () => void;
}) {
  const [state, formAction, pending] = useActionState<SalesFormState, FormData>(
    async (prev, formData) => {
      const result = await saveEmailSample(prev, formData);
      if (result?.success) onDone?.();
      return result;
    },
    undefined,
  );

  return (
    <form action={formAction} className="space-y-2">
      {sample ? (
        <input type="hidden" name="sampleId" value={sample.id} />
      ) : null}
      <input
        type="text"
        name="label"
        required
        maxLength={80}
        defaultValue={sample?.label ?? ""}
        placeholder="Název vzoru, např. restaurace — formální, krátký"
        className={inputClass}
      />
      <input
        type="text"
        name="subject"
        maxLength={150}
        defaultValue={sample?.subject ?? ""}
        placeholder="Předmět (nepovinné)"
        className={inputClass}
      />
      <textarea
        name="body"
        required
        rows={8}
        maxLength={4000}
        defaultValue={sample?.body ?? ""}
        placeholder={
          "Celý e-mail včetně oslovení a podpisu — přesně tak, jak byste ho napsal sám."
        }
        className={`${inputClass} font-mono text-xs`}
      />
      <input
        type="text"
        name="note"
        maxLength={300}
        defaultValue={sample?.note ?? ""}
        placeholder="Co si na něm cenit: nálada, oslovení, čeho se vyvarovat"
        className={inputClass}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : sample ? "Uložit změny" : "Přidat vzor"}
        </button>
        {onDone ? (
          <button
            type="button"
            onClick={onDone}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            zrušit
          </button>
        ) : null}
      </div>
      <FormError message={state?.error} />
      {state?.success ? (
        <p className="text-xs text-emerald-700">{state.success}</p>
      ) : null}
    </form>
  );
}

function SampleRow({ sample }: { sample: EmailSampleItem }) {
  const [editing, setEditing] = useState(false);
  const [deleted, deleteAction, deleting] = useActionState<
    SalesFormState,
    FormData
  >(deleteEmailSample, undefined);

  if (editing) {
    return (
      <li className="py-4">
        <SampleForm sample={sample} onDone={() => setEditing(false)} />
      </li>
    );
  }

  return (
    <li className="space-y-2 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className="text-sm font-medium text-slate-900">{sample.label}</p>
          {sample.active ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-800 ring-1 ring-emerald-100">
              používá se
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              vypnutý
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-xs text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Upravit
          </button>
          <form action={toggleEmailSample}>
            <input type="hidden" name="sampleId" value={sample.id} />
            <button
              type="submit"
              className="text-xs text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
            >
              {sample.active ? "Vypnout" : "Zapnout"}
            </button>
          </form>
          <form action={deleteAction}>
            <input type="hidden" name="sampleId" value={sample.id} />
            <button
              type="submit"
              disabled={deleting}
              className="text-xs text-slate-500 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-60"
            >
              {deleting ? "Mažu…" : "Smazat"}
            </button>
          </form>
        </div>
      </div>

      {sample.subject ? (
        <p className="text-xs text-slate-500">Předmět: {sample.subject}</p>
      ) : null}
      {sample.note ? (
        <p className="text-xs text-slate-600">„{sample.note}“</p>
      ) : null}
      <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs whitespace-pre-wrap text-slate-700">
        {sample.body}
      </pre>
      <FormError message={deleted?.error} />
    </li>
  );
}

/**
 * Vzorové e-maily pro Outreach: pár vlastních e-mailů jako ukázka tónu.
 * Model je dostane před psaním i před AI úpravou návrhu.
 */
export function EmailSamplesPanel({ samples }: { samples: EmailSampleItem[] }) {
  const [adding, setAdding] = useState(false);
  const activeCount = samples.filter((sample) => sample.active).length;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Vzorové e-maily pro oslovení
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-slate-500">
            Vložte pár e-mailů tak, jak byste je napsal sám. Než AI napíše
            oslovení (a než ho na váš pokyn upraví), přečte si z nich tón,
            stavbu, délku i způsob oslovení. Fakta z nich brát nesmí — jsou
            o jiných firmách. Posílá se {MAX_SAMPLES} nejnovější zapnuté.
          </p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
          >
            Přidat vzor
          </button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <SampleForm onDone={() => setAdding(false)} />
        </div>
      ) : null}

      {samples.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Zatím žádný vzor. Bez nich píše AI jen podle promptu Outreache —
          s vašimi e-maily se přiblíží tomu, jak mluvíte vy.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {samples.map((sample) => (
              <SampleRow key={sample.id} sample={sample} />
            ))}
          </ul>
          {activeCount > MAX_SAMPLES ? (
            <p className="text-xs text-amber-700">
              Zapnutých vzorů je {activeCount}, do e-mailu se ale posílají
              {" "}
              {MAX_SAMPLES} naposledy upravené. Ostatní zůstávají v zásobě.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

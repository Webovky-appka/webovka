"use client";

import { useActionState, useRef } from "react";

import {
  createProjectDoc,
  removeProjectDoc,
  type DocFormState,
} from "@/app/actions/docs";
import { FormError } from "@/components/field";
import { formatDateTime } from "@/lib/format";

export type ProjectDocRow = {
  id: string;
  title: string;
  webViewLink: string;
  createdAt: Date;
  createdBy: { name: string } | null;
};

/**
 * Dokumenty zakázky v Google Docs. Editor Googlu se do stránky vložit nedá —
 * Google ho v cizím rámu nespustí — takže odkaz otevírá Docs v nové kartě.
 */
export function DocsPanel({
  projectId,
  templates,
  docs,
  googleEmail,
  docsAllowed,
  googleConfigured,
}: {
  projectId: string;
  templates: { key: string; label: string }[];
  docs: ProjectDocRow[];
  googleEmail: string | null;
  docsAllowed: boolean;
  googleConfigured: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<DocFormState, FormData>(
    async (prevState, formData) => {
      const result = await createProjectDoc(prevState, formData);
      if (!result?.error) formRef.current?.reset();
      return result;
    },
    undefined,
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Dokumenty</h2>
        <p className="mt-1 text-xs text-slate-500">
          Dokument se založí ve vašem Google Drive a otevře se v Google Docs.
          Kolegům ho nasdílíte přímo v Docs, aplikace do sdílení nesahá.
        </p>
      </div>

      {googleEmail && docsAllowed ? (
        <form ref={formRef} action={formAction} className="space-y-2">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="flex flex-wrap gap-2">
            <select
              name="template"
              defaultValue={templates[0]?.key ?? ""}
              aria-label="Předloha dokumentu"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>

            <input
              name="title"
              placeholder="Vlastní název (nepovinné)"
              aria-label="Vlastní název dokumentu"
              className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />

            <button
              type="submit"
              disabled={pending}
              className="shrink-0 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "Zakládám…" : "Založit dokument"}
            </button>
          </div>

          <FormError message={state?.error} />
          <p className="text-xs text-slate-400">
            Zakládá se pod účtem {googleEmail}.
          </p>
        </form>
      ) : (
        <ConnectNotice
          googleEmail={googleEmail}
          googleConfigured={googleConfigured}
        />
      )}

      {docs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Zakázka zatím žádný dokument nemá.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 text-sm">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="group flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div className="min-w-0">
                <a
                  href={doc.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sky-700 underline hover:text-sky-900"
                >
                  {doc.title}
                </a>
                <p className="text-xs text-slate-500">
                  {doc.createdBy?.name ?? "Neznámý"} ·{" "}
                  {formatDateTime(doc.createdAt)}
                </p>
              </div>

              <form action={removeProjectDoc}>
                <input type="hidden" name="docId" value={doc.id} />
                <button
                  type="submit"
                  aria-label={`Odebrat odkaz na dokument ${doc.title}`}
                  title="Odebere jen odkaz v aplikaci, soubor v Drive zůstane"
                  className="text-xs text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                >
                  Odebrat odkaz
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ConnectNotice({
  googleEmail,
  googleConfigured,
}: {
  googleEmail: string | null;
  googleConfigured: boolean;
}) {
  if (!googleConfigured) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Chybí GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET. Postup je v
        DEPLOYMENT.md.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2.5">
      <p className="text-sm text-amber-900">
        {googleEmail
          ? `Napojení účtu ${googleEmail} je starší a nemá právo zakládat dokumenty.`
          : "Zakládání dokumentů potřebuje napojený účet Google."}
      </p>
      <a
        href="/api/google/connect"
        className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        {googleEmail ? "Napojit účet znovu" : "Napojit účet Google"}
      </a>
    </div>
  );
}

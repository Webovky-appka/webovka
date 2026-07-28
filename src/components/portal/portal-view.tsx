"use client";

import type { Phase } from "@prisma/client";
import { useActionState } from "react";

import {
  approvePhase,
  submitPortalFeedback,
  type PortalActionState,
} from "@/app/actions/portal";
import { FormError, inputClasses } from "@/components/field";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";

type PortalData = {
  token: string;
  companyName: string;
  projectName: string;
  phase: Phase;
  portalNote: string | null;
  previewUrl: string | null;
  dueDate: Date | null;
  currentPhaseApproved: boolean;
  approvals: { id: string; phase: Phase; createdAt: Date }[];
  feedback: { id: string; body: string; createdAt: Date }[];
  files: { id: string; filename: string; size: number }[];
};

export function PortalView({ data }: { data: PortalData }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm text-slate-500">{data.companyName}</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {data.projectName}
        </h1>
      </header>

      <PhaseProgress phase={data.phase} dueDate={data.dueDate} />

      {data.portalNote ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">
            Co se právě děje
          </h2>
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
            {data.portalNote}
          </p>
        </section>
      ) : null}

      {data.previewUrl ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Náhled webu</h2>
          <a
            href={data.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm break-all text-sky-700 underline hover:text-sky-900"
          >
            {data.previewUrl}
          </a>
        </section>
      ) : null}

      {data.files.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Soubory ke stažení</h2>
          <ul className="mt-2 space-y-1.5">
            {data.files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-baseline gap-2">
                <a
                  href={`/api/attachments/${file.id}`}
                  className="text-sm break-all text-sky-700 underline hover:text-sky-900"
                >
                  {file.filename}
                </a>
                <span className="text-xs text-slate-400">
                  {formatFileSize(file.size)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ApprovalSection
        token={data.token}
        phase={data.phase}
        alreadyApproved={data.currentPhaseApproved}
      />

      <FeedbackSection token={data.token} />

      {data.approvals.length > 0 || data.feedback.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">
            Vaše schválení a připomínky
          </h2>

          <ul className="space-y-2 text-sm">
            {data.approvals.map((approval) => (
              <li
                key={approval.id}
                className="flex flex-wrap justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"
              >
                <span className="text-emerald-900">
                  Schváleno: {PHASE_LABELS[approval.phase]}
                </span>
                <span className="text-xs text-emerald-700">
                  {formatDateTime(approval.createdAt)}
                </span>
              </li>
            ))}

            {data.feedback.map((item) => (
              <li key={item.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="whitespace-pre-wrap text-slate-700">
                  {item.body}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatDateTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PhaseProgress({
  phase,
  dueDate,
}: {
  phase: Phase;
  dueDate: Date | null;
}) {
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">
          Aktuální fáze: {PHASE_LABELS[phase]}
        </h2>
        {dueDate ? (
          <p className="text-xs text-slate-500">
            Předpokládaný termín: {formatDate(dueDate)}
          </p>
        ) : null}
      </div>

      <ol className="mt-4 flex gap-1.5">
        {PHASE_ORDER.map((item, index) => (
          <li key={item} className="flex-1">
            <div
              className={`h-1.5 rounded-full ${
                index <= currentIndex ? "bg-emerald-500" : "bg-slate-200"
              }`}
            />
            <p
              className={`mt-1.5 text-[11px] ${
                index === currentIndex
                  ? "font-medium text-slate-900"
                  : "text-slate-400"
              }`}
            >
              {PHASE_LABELS[item]}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ApprovalSection({
  token,
  phase,
  alreadyApproved,
}: {
  token: string;
  phase: Phase;
  alreadyApproved: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    PortalActionState,
    FormData
  >(approvePhase, undefined);

  if (alreadyApproved || state?.success) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-900">
          Fázi „{PHASE_LABELS[phase]}“ jste schválili.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          {state?.success ?? "Děkujeme, pokračujeme v práci."}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">
        Schválení fáze „{PHASE_LABELS[phase]}“
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Pokud je vše v pořádku, potvrďte prosím schválení. Zaznamenáme datum
        i čas.
      </p>

      <FormError message={state?.error} />

      <form
        action={formAction}
        className="mt-3"
        onSubmit={(event) => {
          if (
            !window.confirm(
              `Schválit fázi „${PHASE_LABELS[phase]}“? Schválení potvrzuje, že současný stav odpovídá zadání.`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Schválit tuto fázi"}
        </button>
      </form>
    </section>
  );
}

function FeedbackSection({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<
    PortalActionState,
    FormData
  >(submitPortalFeedback, undefined);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Připomínka</h2>
      <p className="mt-1 text-sm text-slate-600">
        Něco není v pořádku nebo chcete něco upravit? Napište nám to sem.
      </p>

      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="token" value={token} />
        <textarea
          name="body"
          rows={4}
          required
          placeholder="Například: na homepage bychom chtěli jinou fotku."
          className={inputClasses}
        />

        <FormError message={state?.error} />
        {state?.success ? (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Odesílám…" : "Odeslat připomínku"}
        </button>
      </form>
    </section>
  );
}

"use client";

import { useActionState, useState } from "react";

import {
  approvePhase,
  submitPortalFeedback,
  type PortalActionState,
} from "@/app/actions/portal";
import { FormError, inputClasses } from "@/components/field";
import { SiteEmbed } from "@/components/site-embed";
import { formatDateTime, formatDay, formatFileSize } from "@/lib/format";
import { sortPhases, type PhaseLike } from "@/lib/phases";

type PortalData = {
  token: string;
  companyName: string;
  projectName: string;
  phases: PhaseLike[];
  currentPhaseName: string | null;
  currentPhaseDueDate: Date | null;
  portalNote: string | null;
  previewUrl: string | null;
  currentPhaseApproved: boolean;
  approvals: { id: string; phaseName: string; createdAt: Date }[];
  feedback: { id: string; body: string; createdAt: Date }[];
  files: { id: string; filename: string; size: number }[];
};

/**
 * @param readOnly Náhled pro interní uživatele. Vykreslí totéž, co vidí klient,
 * ale bez možnosti cokoli schválit nebo odeslat — z náhledu se nesmí dát
 * omylem schválit fáze za klienta.
 */
export function PortalView({
  data,
  readOnly = false,
}: {
  data: PortalData;
  readOnly?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      <header>
        <p className="text-sm text-slate-500">{data.companyName}</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {data.projectName}
        </h1>
      </header>

      <PhaseProgress
        phases={data.phases}
        currentPhaseName={data.currentPhaseName}
        dueDate={data.currentPhaseDueDate}
      />

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
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-medium text-slate-900">Odkazy</h2>

          <SiteEmbed url={data.previewUrl!} title="Nový web" defaultOpen />
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

      {readOnly ? (
        <ReadOnlyActions
          phaseName={data.currentPhaseName}
          alreadyApproved={data.currentPhaseApproved}
        />
      ) : (
        <>
          <ApprovalSection
            token={data.token}
            phaseName={data.currentPhaseName}
            alreadyApproved={data.currentPhaseApproved}
          />
          <FeedbackSection token={data.token} />
        </>
      )}

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
                  Schváleno: {approval.phaseName}
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

/** Místo funkčních akcí jen popis toho, co by klient mohl udělat. */
function ReadOnlyActions({
  phaseName,
  alreadyApproved,
}: {
  phaseName: string | null;
  alreadyApproved: boolean;
}) {
  return (
    <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
      <h2 className="text-sm font-medium text-slate-900">Akce klienta</h2>
      <p className="mt-1 text-sm text-slate-600">
        {alreadyApproved
          ? `Fázi „${phaseName ?? ""}“ už klient schválil.`
          : `Klient tady vidí tlačítko pro schválení fáze „${phaseName ?? ""}“ a formulář pro připomínku.`}
      </p>
      <p className="mt-2 text-xs text-slate-500">
        V náhledu jsou obě akce vypnuté, aby nešlo schválit fázi za klienta.
      </p>
    </section>
  );
}

function PhaseProgress({
  phases,
  currentPhaseName,
  dueDate,
}: {
  phases: PhaseLike[];
  currentPhaseName: string | null;
  dueDate: Date | null;
}) {
  const ordered = sortPhases(phases);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">
          Aktuální fáze:{" "}
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 ring-1 ring-amber-200 ring-inset">
            {currentPhaseName ?? "—"}
          </span>
        </h2>
        {dueDate ? (
          <p className="text-xs text-slate-500">
            Předpokládaný termín: {formatDay(dueDate)}
          </p>
        ) : null}
      </div>

      <ol className="mt-4 flex gap-1.5">
        {ordered.map((item) => {
          const isCurrent = item.name === currentPhaseName;
          return (
            <li key={item.id} className="min-w-16 flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  isCurrent
                    ? "bg-amber-400"
                    : item.completedAt !== null
                      ? "bg-emerald-500"
                      : "bg-slate-200"
                }`}
              />
              <p
                className={`mt-1.5 text-[11px] ${
                  isCurrent ? "font-medium text-amber-700" : "text-slate-400"
                }`}
              >
                {item.name}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ApprovalSection({
  token,
  phaseName,
  alreadyApproved,
}: {
  token: string;
  phaseName: string | null;
  alreadyApproved: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    PortalActionState,
    FormData
  >(approvePhase, undefined);
  const [confirming, setConfirming] = useState(false);

  if (alreadyApproved || state?.success) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-900">
          Fázi „{phaseName}“ jste schválili.
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
        Schválení fáze „{phaseName}“
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Pokud je vše v pořádku, potvrďte prosím schválení. Zaznamenáme datum
        i čas.
      </p>

      <FormError message={state?.error} />

      {confirming ? (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <p className="text-sm text-emerald-900">
            Schválením potvrzujete, že současný stav odpovídá zadání.
            Zaznamenáme datum i čas.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <form action={formAction}>
              <input type="hidden" name="token" value={token} />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? "Ukládám…" : `Ano, schvaluji fázi ${phaseName}`}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-emerald-800 transition hover:text-emerald-950"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          Schválit tuto fázi
        </button>
      )}
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

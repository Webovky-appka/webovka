"use client";

import type { Phase } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";

import {
  createPortalLink,
  revokePortalLink,
  type PortalLinkState,
} from "@/app/actions/portal";
import { FormError } from "@/components/field";
import { formatDate, formatDateTime } from "@/lib/format";
import { PHASE_LABELS } from "@/lib/phases";

export function PortalLinkPanel({
  projectId,
  previewHref,
  portalLink,
  approvals,
}: {
  projectId: string;
  previewHref: string;
  portalLink: {
    id: string;
    expiresAt: Date | null;
    lastVisitedAt: Date | null;
    createdAt: Date;
  } | null;
  approvals: {
    id: string;
    phase: Phase;
    createdAt: Date;
    ipAddress: string | null;
    snapshotNote: string | null;
    snapshotPreviewUrl: string | null;
  }[];
}) {
  const [state, formAction, pending] = useActionState<
    PortalLinkState,
    FormData
  >(createPortalLink, undefined);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-slate-900">
            Odkaz pro klienta
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Klient se dostane ke svému projektu odkazem a šestimístným PIN
            kódem. Účet nepotřebuje.
          </p>
        </div>
        <Link
          href={previewHref}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          Zobrazit jako klient
        </Link>
      </div>

      {portalLink ? (
        <dl className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs">
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Vytvořen</dt>
            <dd className="text-slate-700">
              {formatDate(portalLink.createdAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Platí do</dt>
            <dd className="text-slate-700">
              {formatDate(portalLink.expiresAt)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-slate-500">Naposledy otevřen</dt>
            <dd className="text-slate-700">
              {portalLink.lastVisitedAt
                ? formatDateTime(portalLink.lastVisitedAt)
                : "nikdy"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Zakázka zatím nemá aktivní odkaz do portálu.
        </p>
      )}

      {state?.url && state.pin ? (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-medium text-amber-900">
            Zkopírujte a pošlete klientovi. PIN už znovu neuvidíte.
          </p>
          <p className="break-all rounded bg-white px-2 py-1.5 font-mono text-xs text-slate-800">
            {state.url}
          </p>
          <p className="rounded bg-white px-2 py-1.5 font-mono text-lg tracking-widest text-slate-900">
            {state.pin}
          </p>
        </div>
      ) : null}

      <FormError message={state?.error} />

      <div className="flex flex-wrap items-center gap-2">
        <form action={formAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {pending
              ? "Generuji…"
              : portalLink
                ? "Vygenerovat nový odkaz"
                : "Vygenerovat odkaz"}
          </button>
        </form>

        {portalLink ? (
          <form action={revokePortalLink}>
            <input type="hidden" name="portalLinkId" value={portalLink.id} />
            <button
              type="submit"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-500 transition hover:text-red-600"
            >
              Zneplatnit
            </button>
          </form>
        ) : null}
      </div>

      {portalLink ? (
        <p className="text-xs text-slate-500">
          Vygenerováním nového odkazu ten starý okamžitě přestane platit.
        </p>
      ) : null}

      {approvals.length > 0 ? (
        <div className="space-y-1.5">
          <h3 className="text-sm font-medium text-slate-900">
            Schválení klientem
          </h3>
          <ul className="space-y-1.5 text-xs">
            {approvals.map((approval) => (
              <li
                key={approval.id}
                className="rounded bg-emerald-50 px-2 py-1.5"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-emerald-900">
                    {PHASE_LABELS[approval.phase]}
                  </span>
                  <span className="text-emerald-700">
                    {formatDateTime(approval.createdAt)}
                  </span>
                </div>

                {/* Zmrazený stav je doklad, co klient v tu chvíli viděl. */}
                {approval.snapshotNote || approval.snapshotPreviewUrl ? (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-emerald-700 hover:text-emerald-900">
                      Co klient schvaloval
                    </summary>
                    <div className="mt-1 space-y-1 text-emerald-900">
                      {approval.snapshotNote ? (
                        <p className="whitespace-pre-wrap">
                          {approval.snapshotNote}
                        </p>
                      ) : (
                        <p className="text-emerald-700">Bez poznámky.</p>
                      )}
                      {approval.snapshotPreviewUrl ? (
                        <p className="break-all">
                          Náhled: {approval.snapshotPreviewUrl}
                        </p>
                      ) : null}
                      {approval.ipAddress ? (
                        <p className="text-emerald-700">
                          IP: {approval.ipAddress}
                        </p>
                      ) : null}
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

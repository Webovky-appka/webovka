import Link from "next/link";
import { notFound } from "next/navigation";

import { RunTicker } from "@/components/sales/run-ticker";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { formatCost } from "@/lib/sales/pricing";
import type { RunStats } from "@/lib/sales/run";

export const metadata = {
  title: "Běh kampaně — Mitsov Web",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  QUEUED: "Ve frontě",
  RUNNING: "Běží",
  COMPLETED: "Dokončený",
  FAILED: "Selhal",
};

const LEAD_STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Objevený",
  QUALIFIED: "Kvalifikovaný",
  REJECTED: "Zamítnutý",
};

export default async function RunPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await props.params;

  const run = await prisma.salesRun.findUnique({
    where: { id },
    include: {
      campaign: { select: { id: true, name: true, minScore: true } },
      agentRuns: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!run) notFound();

  const stats = (run.stats ?? {}) as Partial<RunStats>;
  const leadIds = stats.leadIds ?? [];

  const leads =
    leadIds.length > 0
      ? await prisma.salesLead.findMany({
          where: { id: { in: leadIds } },
          include: { prospect: true },
          orderBy: { score: { sort: "desc", nulls: "last" } },
        })
      : [];

  const totalCost = run.agentRuns.reduce(
    (sum, agentRun) => sum + agentRun.costMicroUsd,
    0,
  );
  const live = run.status === "QUEUED" || run.status === "RUNNING";

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/sales/${run.campaign.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← {run.campaign.name}
        </Link>

        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Běh {formatDateTime(run.createdAt)}
          </h1>
          <p className="text-sm text-slate-500">
            {RUN_STATUS_LABELS[run.status] ?? run.status}
            {totalCost > 0 ? ` · cena ${formatCost(totalCost)}` : ""}
          </p>
        </div>
      </div>

      {live ? <RunTicker runId={run.id} /> : null}

      {run.error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {run.error}
        </p>
      ) : null}

      {!live ? (
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-5">
          {[
            ["Prohlédnuto", stats.inspected ?? 0],
            ["Založeno", stats.created ?? 0],
            ["Kvalifikováno", stats.qualified ?? 0],
            ["Zamítnuto", stats.rejected ?? 0],
            ["Přeskočeno", stats.skipped?.length ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-xs text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold text-slate-900">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {leads.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-medium text-slate-900">Leady z tohoto běhu</h2>
          <ul className="space-y-2">
            {leads.map((lead) => (
              <li
                key={lead.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900">
                      {lead.prospect.name}
                    </p>
                    {lead.prospect.domain ? (
                      <a
                        href={`https://${lead.prospect.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-sky-700 underline hover:text-sky-900"
                      >
                        {lead.prospect.domain}
                      </a>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-900">
                      {lead.score ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {LEAD_STATUS_LABELS[lead.status] ?? lead.status}
                      {lead.opportunityGap !== null
                        ? ` · gap ${lead.opportunityGap > 0 ? "+" : ""}${lead.opportunityGap}`
                        : ""}
                    </p>
                  </div>
                </div>
                {lead.reason ? (
                  <p className="mt-2 text-sm text-slate-600">{lead.reason}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {stats.skipped && stats.skipped.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Přeskočení kandidáti
          </h2>
          <ul className="space-y-1 text-sm text-slate-600">
            {stats.skipped.map((item, index) => (
              <li key={index}>
                {item.name} — {item.reason}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Pracovní log</h2>
        {(stats.log ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">Zatím prázdný.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(stats.log ?? []).map((entry, index) => (
              <li key={index} className="flex gap-3">
                <span className="shrink-0 font-mono text-xs text-slate-400">
                  {formatDateTime(new Date(entry.at))}
                </span>
                <span className="text-slate-700">{entry.text}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Volání modelů</h2>
        {run.agentRuns.length === 0 ? (
          <p className="text-sm text-slate-500">Žádné.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {run.agentRuns.map((agentRun) => (
              <li
                key={agentRun.id}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-slate-700">
                  {agentRun.agent}
                  <span className="text-slate-400"> · {agentRun.model}</span>
                  {agentRun.status === "FAILED" ? (
                    <span className="text-red-600"> · selhalo</span>
                  ) : null}
                </span>
                <span className="text-xs text-slate-500">
                  {agentRun.tokensIn + agentRun.tokensOut} tokenů ·{" "}
                  {formatCost(agentRun.costMicroUsd)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

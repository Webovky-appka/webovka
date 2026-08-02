import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeFunnel, type StatusCounts } from "@/lib/sales/funnel";
import { formatCost } from "@/lib/sales/pricing";

export const metadata = {
  title: "Analytika — Mitsov Web",
};

/**
 * Funnel a ceny (sekce 32 a 45 specifikace). Primární metrika není počet
 * vygenerovaných leadů, ale cesta od kandidáta ke klientovi — a kolik stojí.
 */
export default async function SalesAnalyticsPage() {
  await requireUser();

  const [statusGroups, campaigns, costTotal, costByAgent] = await Promise.all([
    prisma.salesLead.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.salesCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: { leads: { select: { status: true } } },
    }),
    prisma.agentRun.aggregate({ _sum: { costMicroUsd: true } }),
    prisma.agentRun.groupBy({
      by: ["agent"],
      _sum: { costMicroUsd: true, tokensIn: true, tokensOut: true },
      _count: { _all: true },
    }),
  ]);

  const counts: StatusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const funnel = computeFunnel(counts);

  const totalCost = costTotal._sum.costMicroUsd ?? 0;
  const qualified =
    funnel.stages.find((stage) => stage.key === "QUALIFIED")?.reached ?? 0;
  const contacted =
    funnel.stages.find((stage) => stage.key === "CONTACTED")?.reached ?? 0;
  const replied =
    funnel.stages.find((stage) => stage.key === "REPLIED")?.reached ?? 0;

  const per = (count: number) =>
    count === 0 ? "—" : formatCost(Math.round(totalCost / count));

  const maxReached = Math.max(1, funnel.stages[0]?.reached ?? 1);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/sales"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← AI Sales
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Analytika
        </h1>
        <p className="text-sm text-slate-500">
          Cesta od kandidáta ke klientovi a kolik stojí. Počítá se ze stavů
          leadů a ze záznamů o volání modelů.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Trychtýř</h2>
        <ul className="space-y-2">
          {funnel.stages.map((stage) => (
            <li key={stage.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-slate-600">
                {stage.label}
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-sky-500"
                  style={{
                    width: `${Math.max(2, Math.round((stage.reached / maxReached) * 100))}%`,
                  }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-900">
                {stage.reached}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          Zamítnuto {funnel.rejected} · prohráno {funnel.lost}
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Reply rate", funnel.replyRate, "odpovědi z oslovených"],
          ["Meeting rate", funnel.meetingRate, "schůzky z odpovědí"],
          ["Close rate", funnel.closeRate, "výhry z oslovených"],
        ].map(([label, value, hint]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {value === null ? "—" : `${value} %`}
            </p>
            <p className="text-xs text-slate-400">{hint}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Náklady na AI</h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Celkem</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {formatCost(totalCost)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Na kvalifikovaný lead</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {per(qualified)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Na osloveného</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {per(contacted)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Na odpověď</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {per(replied)}
            </dd>
          </div>
        </dl>

        <ul className="divide-y divide-slate-100 text-sm">
          {costByAgent
            .sort(
              (a, b) =>
                (b._sum.costMicroUsd ?? 0) - (a._sum.costMicroUsd ?? 0),
            )
            .map((row) => (
              <li
                key={row.agent}
                className="flex flex-wrap items-baseline justify-between gap-2 py-2"
              >
                <span className="text-slate-700">
                  {row.agent}
                  <span className="text-slate-400">
                    {" "}
                    · {row._count._all} volání
                  </span>
                </span>
                <span className="text-xs text-slate-500">
                  {(row._sum.tokensIn ?? 0) + (row._sum.tokensOut ?? 0)} tokenů
                  · {formatCost(row._sum.costMicroUsd ?? 0)}
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-medium text-slate-900">Po kampaních</h2>
        <ul className="space-y-2">
          {campaigns.map((campaign) => {
            const campaignCounts: StatusCounts = {};
            for (const lead of campaign.leads) {
              campaignCounts[lead.status] =
                (campaignCounts[lead.status] ?? 0) + 1;
            }
            const campaignFunnel = computeFunnel(campaignCounts);
            const stage = (key: string) =>
              campaignFunnel.stages.find((item) => item.key === key)
                ?.reached ?? 0;

            return (
              <li
                key={campaign.id}
                className="rounded-xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/sales/${campaign.id}`}
                    className="font-medium text-slate-900 hover:underline"
                  >
                    {campaign.name}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {campaign.leads.length} leadů
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Kvalifikovaní {stage("QUALIFIED")} · ke schválení{" "}
                  {stage("READY_FOR_REVIEW")} · oslovení {stage("CONTACTED")} ·
                  odpovědi {stage("REPLIED")} · výhry {campaignFunnel.won} ·
                  zamítnutí {campaignFunnel.rejected}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

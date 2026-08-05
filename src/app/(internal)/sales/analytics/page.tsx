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
 * vygenerovaných příležitostí, ale cesta od kandidáta ke klientovi — a kolik
 * stojí. Výchozí pohled počítá jen nearchivované kampaně; archivované jdou
 * přibrat přepínačem, aby historická čísla nikam nezmizela.
 */
export default async function SalesAnalyticsPage(props: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  await requireUser();
  const { archiv } = await props.searchParams;
  const includeArchived = archiv === "1";

  const allCampaigns = await prisma.salesCampaign.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, status: true },
  });
  const campaignsInView = includeArchived
    ? allCampaigns
    : allCampaigns.filter((campaign) => campaign.status !== "ARCHIVED");
  const campaignIds = campaignsInView.map((campaign) => campaign.id);
  const archivedCount = allCampaigns.length - campaignsInView.length;

  const [statusGroups, campaignLeads, costTotal, costByAgent] =
    await Promise.all([
      prisma.salesLead.groupBy({
        by: ["status"],
        where: { campaignId: { in: campaignIds } },
        _count: { _all: true },
      }),
      prisma.salesLead.findMany({
        where: { campaignId: { in: campaignIds } },
        select: { campaignId: true, status: true },
      }),
      prisma.agentRun.aggregate({
        where: { campaignId: { in: campaignIds } },
        _sum: { costMicroUsd: true },
      }),
      prisma.agentRun.groupBy({
        by: ["agent"],
        where: { campaignId: { in: campaignIds } },
        _sum: { costMicroUsd: true, tokensIn: true, tokensOut: true },
        _count: { _all: true },
      }),
    ]);

  const counts: StatusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count._all]),
  );
  const funnel = computeFunnel(counts);

  const totalCost = costTotal._sum.costMicroUsd ?? 0;
  const reached = (key: string) =>
    funnel.stages.find((stage) => stage.key === key)?.reached ?? 0;
  const qualified = reached("QUALIFIED");
  const contacted = reached("CONTACTED");
  const replied = reached("REPLIED");
  const meetings = reached("MEETING");

  const per = (count: number) =>
    count === 0 ? "—" : formatCost(Math.round(totalCost / count));

  const maxReached = Math.max(1, funnel.stages[0]?.reached ?? 1);

  const rateTiles: {
    label: string;
    value: number | null;
    fraction: string;
    hint: string;
  }[] = [
    {
      label: "Reply rate",
      value: funnel.replyRate,
      fraction: `${replied} z ${contacted}`,
      hint: "odpovědi z oslovených",
    },
    {
      label: "Meeting rate",
      value: funnel.meetingRate,
      fraction: `${meetings} z ${replied}`,
      hint: "schůzky z odpovědí",
    },
    {
      label: "Close rate",
      value: funnel.closeRate,
      fraction: `${funnel.won} z ${contacted}`,
      hint: "výhry z oslovených",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
            příležitostí a ze záznamů o volání modelů
            {includeArchived
              ? " — včetně archivovaných kampaní."
              : archivedCount > 0
                ? " — bez archivovaných kampaní."
                : "."}
          </p>
        </div>
        {archivedCount > 0 || includeArchived ? (
          <Link
            scroll={false}
            href={
              includeArchived ? "/sales/analytics" : "/sales/analytics?archiv=1"
            }
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            {includeArchived
              ? "Skrýt archivované"
              : `Zahrnout archivované (${archivedCount})`}
          </Link>
        ) : null}
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Trychtýř</h2>
          <p className="text-xs text-slate-500">
            Kumulativně: každá fáze počítá příležitosti, které se dostaly
            aspoň tam. Šedé číslo říká, kolik jich ve fázi stojí právě teď.
          </p>
        </div>
        <ul className="space-y-2">
          {funnel.stages.map((stage) => {
            const current = counts[stage.key] ?? 0;
            return (
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
                <span className="w-24 shrink-0 text-right text-sm">
                  <span className="font-medium text-slate-900">
                    {stage.reached}
                  </span>
                  <span className="text-xs text-slate-400"> · teď {current}</span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500">
          Zamítnuto {funnel.rejected} (počítá se jen do Objevení) · prohráno{" "}
          {funnel.lost} (počítá se do Oslovení)
        </p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        {rateTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs text-slate-500">{tile.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {tile.value === null ? "—" : `${tile.value} %`}
            </p>
            <p className="text-xs text-slate-400">
              {tile.value === null
                ? tile.hint
                : `${tile.fraction} — ${tile.hint}`}
            </p>
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
            <dt className="text-xs text-slate-500">Na kvalifikovanou</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {per(qualified)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Na oslovenou</dt>
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
              (a, b) => (b._sum.costMicroUsd ?? 0) - (a._sum.costMicroUsd ?? 0),
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
          {campaignsInView.map((campaign) => {
            const leadsOfCampaign = campaignLeads.filter(
              (lead) => lead.campaignId === campaign.id,
            );
            const campaignCounts: StatusCounts = {};
            for (const lead of leadsOfCampaign) {
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
                    {campaign.status === "ARCHIVED" ? (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                        archivovaná
                      </span>
                    ) : null}
                  </Link>
                  <span className="text-xs text-slate-500">
                    {leadsOfCampaign.length} příležitostí
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  Kvalifikované {stage("QUALIFIED")} · ke schválení{" "}
                  {campaignCounts["READY_FOR_REVIEW"] ?? 0} · oslovené{" "}
                  {stage("CONTACTED")} · odpovědi {stage("REPLIED")} · výhry{" "}
                  {campaignFunnel.won} · zamítnuté {campaignFunnel.rejected}
                </p>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

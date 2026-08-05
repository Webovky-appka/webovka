import Link from "next/link";

import { NewCampaignForm } from "@/components/sales/new-campaign-form";
import { CampaignStatusField } from "@/components/sales/campaign-status-field";
import { requireUser } from "@/lib/auth";
import { pluralCs } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "AI Sales — Mitsov Web",
};

/** Kolik příležitostí ke schválení se ukazuje na úvodu. Zbytek je v kampaních. */
const REVIEW_QUEUE_LIMIT = 10;

export default async function SalesPage(props: {
  searchParams: Promise<{ archiv?: string }>;
}) {
  await requireUser();
  const { archiv } = await props.searchParams;
  const showArchived = archiv === "1";

  const [campaigns, reviewQueue, reviewTotal] = await Promise.all([
    prisma.salesCampaign.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { leads: true, runs: true } },
        leads: {
          where: { status: "READY_FOR_REVIEW" },
          select: { id: true },
        },
      },
    }),
    // Z fronty ke schválení jen to nejlepší — a nikdy z archivovaných kampaní.
    prisma.salesLead.findMany({
      where: {
        status: "READY_FOR_REVIEW",
        campaign: { status: { not: "ARCHIVED" } },
      },
      orderBy: { score: { sort: "desc", nulls: "last" } },
      take: REVIEW_QUEUE_LIMIT,
      include: {
        prospect: { select: { name: true, domain: true } },
        campaign: { select: { name: true, minScore: true } },
      },
    }),
    prisma.salesLead.count({
      where: {
        status: "READY_FOR_REVIEW",
        campaign: { status: { not: "ARCHIVED" } },
      },
    }),
  ]);

  const activeCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ACTIVE",
  );
  const pausedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "PAUSED",
  );
  const archivedCampaigns = campaigns.filter(
    (campaign) => campaign.status === "ARCHIVED",
  );
  // Aktivní nahoře, pozastavené úplně dole — archivované až za tlačítkem.
  const visibleCampaigns = [...activeCampaigns, ...pausedCampaigns];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            AI Sales
          </h1>
          <p className="text-sm text-slate-500">
            Tým agentů na hledání nových klientů. Kampaň říká, co se hledá;
            agenti připraví příležitosti a vy je schválíte.
          </p>
        </div>
        <Link
          href="/sales/analytics"
          className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Analytika
        </Link>
      </div>

      {reviewQueue.length > 0 ? (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <div>
            <h2 className="text-sm font-semibold text-emerald-900">
              Ke schválení ({reviewTotal})
            </h2>
            <p className="text-xs text-emerald-800/70">
              Nejlepších {Math.min(reviewQueue.length, REVIEW_QUEUE_LIMIT)}{" "}
              podle skóre. Nic se neodešle bez vašeho souhlasu.
            </p>
          </div>
          <ul className="space-y-1.5">
            {reviewQueue.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/sales/leads/${lead.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-emerald-100 transition hover:bg-emerald-50"
                >
                  {lead.screenshotDesktopKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/sales/screenshots/${lead.id}/desktop`}
                      alt=""
                      className="h-10 w-16 shrink-0 rounded border border-slate-200 object-cover object-top"
                    />
                  ) : (
                    <span className="h-10 w-16 shrink-0 rounded border border-dashed border-slate-200 bg-slate-50" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {lead.prospect.name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {lead.campaign.name}
                      {lead.prospect.domain ? ` · ${lead.prospect.domain}` : ""}
                    </span>
                  </span>
                  <span className="text-right">
                    <span
                      className={`block text-sm font-semibold ${
                        (lead.score ?? 0) >= lead.campaign.minScore
                          ? "text-emerald-700"
                          : "text-red-600"
                      }`}
                    >
                      {lead.score ?? "—"}
                    </span>
                    <span className="block text-xs text-slate-400">skóre</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {reviewTotal > REVIEW_QUEUE_LIMIT ? (
            <p className="text-xs text-emerald-800/70">
              Dalších {reviewTotal - REVIEW_QUEUE_LIMIT} čeká v jednotlivých
              kampaních.
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Nová kampaň</h2>
          <p className="mt-1 text-xs text-slate-500">
            Mise, segment, oblast i rozvrh — vše hned při založení.
          </p>
        </div>
        <NewCampaignForm />
      </section>

      {visibleCampaigns.length === 0 && archivedCampaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Zatím žádná kampaň. Založte první — třeba restaurace v okolí se
          zastaralým webem.
        </p>
      ) : (
        <section className="space-y-3">
          <h2 className="font-medium text-slate-900">Kampaně</h2>
          {visibleCampaigns.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-6 text-center text-sm text-slate-500">
              Žádná aktivní kampaň.
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </ul>
          )}
        </section>
      )}

      {archivedCampaigns.length > 0 ? (
        <section className="space-y-3">
          <Link
            href={showArchived ? "/sales" : "/sales?archiv=1"}
            className="inline-block rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            {showArchived
              ? "Skrýt archivované kampaně"
              : `Archivované kampaně (${archivedCampaigns.length})`}
          </Link>
          {showArchived ? (
            <ul className="space-y-2 opacity-75">
              {archivedCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

type CampaignWithCounts = {
  id: string;
  name: string;
  mission: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  dailyLimit: number;
  minScore: number;
  _count: { leads: number; runs: number };
  leads: { id: string }[];
};

function CampaignCard({ campaign }: { campaign: CampaignWithCounts }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/sales/${campaign.id}`}
            className="font-medium text-slate-900 hover:underline"
          >
            {campaign.name}
          </Link>
          <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
            {campaign.mission}
          </p>
        </div>
        <CampaignStatusField campaignId={campaign.id} status={campaign.status} />
      </div>

      {campaign.leads.length > 0 && campaign.status !== "ARCHIVED" ? (
        <p className="mt-2 text-sm font-medium text-emerald-700">
          {campaign.leads.length}{" "}
          {pluralCs(
            campaign.leads.length,
            "příležitost čeká",
            "příležitosti čekají",
            "příležitostí čeká",
          )}{" "}
          na schválení
        </p>
      ) : null}
      <p className="mt-3 text-xs text-slate-500">
        {campaign._count.leads}{" "}
        {pluralCs(
          campaign._count.leads,
          "příležitost",
          "příležitosti",
          "příležitostí",
        )}{" "}
        · {campaign._count.runs}{" "}
        {pluralCs(campaign._count.runs, "běh", "běhy", "běhů")} · limit{" "}
        {campaign.dailyLimit}/den · minimální skóre {campaign.minScore}
      </p>
    </li>
  );
}

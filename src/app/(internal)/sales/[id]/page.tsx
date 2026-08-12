import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignSettingsForm } from "@/components/sales/campaign-settings-form";
import { CampaignStatusField } from "@/components/sales/campaign-status-field";
import { PromptEditor } from "@/components/sales/prompt-editor";
import { StartRunForm } from "@/components/sales/start-run-form";
import { requireUser } from "@/lib/auth";
import { formatDateTime, pluralCs } from "@/lib/format";
import { AGENT_INFO, SALES_AGENTS } from "@/lib/sales/agents";
import { getActivePrompt } from "@/lib/sales/prompts";
import { toggleViewPref } from "@/app/actions/sales";
import { prisma } from "@/lib/prisma";
import { isPrefOn, SHOW_REJECTED_COOKIE } from "@/lib/sales/view-prefs";
import {
  PHASE_HEADING_CLASS,
  statusLabelClass,
  type LeadPhase,
} from "@/lib/sales/status-style";

export const metadata = {
  title: "Kampaň — Mitsov Web",
};

const RUN_LABELS: Record<string, string> = {
  QUEUED: "Ve frontě",
  RUNNING: "Běží",
  COMPLETED: "Dokončený",
  FAILED: "Selhal",
};

/** Skupiny seznamu: rozpracované, jednání, výhry a prohry zvlášť. */
const LEAD_GROUPS: {
  title: string;
  phase: LeadPhase;
  statuses: string[];
}[] = [
  {
    title: "V přípravě",
    phase: "prep",
    statuses: [
      "DISCOVERED",
      "QUALIFYING",
      "QUALIFIED",
      "RESEARCHING",
      "READY_FOR_REVIEW",
      "APPROVED",
    ],
  },
  {
    title: "Oslovené — jednáme",
    phase: "talking",
    statuses: ["CONTACTED", "REPLIED", "MEETING", "PROPOSAL"],
  },
  { title: "Vyhrané", phase: "won", statuses: ["WON"] },
  { title: "Prohrané", phase: "lost", statuses: ["LOST"] },
];

const LEAD_LABELS: Record<string, string> = {
  DISCOVERED: "Objevená",
  QUALIFYING: "Kvalifikuje se",
  QUALIFIED: "Kvalifikovaná",
  RESEARCHING: "Doplňuje se research",
  READY_FOR_REVIEW: "Ke schválení",
  APPROVED: "Schválená",
  CONTACTED: "Oslovená",
  REPLIED: "Odpověděli",
  MEETING: "Schůzka",
  PROPOSAL: "Nabídka",
  WON: "Vyhraná",
  LOST: "Prohraná",
  REJECTED: "Zamítnutá",
};

export default async function CampaignPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zamitnute?: string }>;
}) {
  await requireUser();
  const { id } = await props.params;
  // Rozbalení si pamatuje cookie; `?zamitnute=1` ze starých odkazů pořád
  // funguje, aby už rozeslané adresy nezůstaly slepé.
  const { zamitnute } = await props.searchParams;
  const cookieStore = await cookies();
  const showRejected =
    zamitnute === "1" || isPrefOn(cookieStore.get(SHOW_REJECTED_COOKIE)?.value);

  const [campaign, rejectedCount, rejectedLeads] = await Promise.all([
    prisma.salesCampaign.findUnique({
      where: { id },
      include: {
        runs: { orderBy: { createdAt: "desc" }, take: 10 },
        // Aktivní příležitosti od nejlepší — zamítnuté mají vlastní seznam.
        leads: {
          where: { status: { not: "REJECTED" } },
          orderBy: { score: { sort: "desc", nulls: "last" } },
          take: 30,
          include: { prospect: { select: { name: true, domain: true } } },
        },
        _count: { select: { leads: true } },
      },
    }),
    prisma.salesLead.count({ where: { campaignId: id, status: "REJECTED" } }),
    showRejected
      ? prisma.salesLead.findMany({
          where: { campaignId: id, status: "REJECTED" },
          orderBy: { score: { sort: "desc", nulls: "last" } },
          take: 50,
          include: { prospect: { select: { name: true, domain: true } } },
        })
      : Promise.resolve([]),
  ]);

  if (!campaign) notFound();

  const hasLiveRun = campaign.runs.some(
    (run) => run.status === "QUEUED" || run.status === "RUNNING",
  );

  const prompts = await Promise.all(
    SALES_AGENTS.map(async (agent) => ({
      agent,
      prompt: await getActivePrompt(agent),
    })),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/sales"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Kampaně
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {campaign.name}
            </h1>
            <p className="text-sm text-slate-500">
              {campaign._count.leads}{" "}
              {pluralCs(
                campaign._count.leads,
                "příležitost",
                "příležitosti",
                "příležitostí",
              )}{" "}
              celkem · práh skóre {campaign.minScore}
            </p>
          </div>
          <CampaignStatusField
            campaignId={campaign.id}
            status={campaign.status}
          />
        </div>
      </div>

      {LEAD_GROUPS.map((group) => {
        const groupLeads = campaign.leads.filter((lead) =>
          group.statuses.includes(lead.status),
        );
        if (groupLeads.length === 0) return null;
        return (
          <section key={group.title} className="space-y-3">
            <h2 className={`font-medium ${PHASE_HEADING_CLASS[group.phase]}`}>
              {group.title} ({groupLeads.length})
            </h2>
            <ul className="space-y-2">
              {groupLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      {lead.screenshotDesktopKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/sales/screenshots/${lead.id}/desktop`}
                          alt=""
                          className="h-12 w-20 shrink-0 rounded border border-slate-200 object-cover object-top"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <Link
                          href={`/sales/leads/${lead.id}`}
                          className="font-medium text-slate-900 hover:underline"
                        >
                          {lead.prospect.name}
                        </Link>{" "}
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
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-lg font-semibold ${
                          lead.score === null
                            ? "text-slate-900"
                            : lead.score >= campaign.minScore
                              ? "text-emerald-700"
                              : "text-red-600"
                        }`}
                      >
                        {lead.score ?? "—"}
                      </p>
                      <p className={`text-xs ${statusLabelClass(lead.status)}`}>
                        {LEAD_LABELS[lead.status] ?? lead.status}
                      </p>
                    </div>
                  </div>
                  {lead.reason ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {lead.reason}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {rejectedCount > 0 ? (
        <section className="space-y-3">
          <form action={toggleViewPref}>
            <input type="hidden" name="pref" value={SHOW_REJECTED_COOKIE} />
            <input type="hidden" name="path" value={`/sales/${campaign.id}`} />
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              {showRejected
                ? "Skrýt zamítnuté"
                : `Zobrazit zamítnuté (${rejectedCount})`}
            </button>
          </form>
          {showRejected ? (
            <ul className="space-y-2">
              {rejectedLeads.map((lead) => (
                <li
                  key={lead.id}
                  className="rounded-xl border border-red-100 bg-white p-4 opacity-90"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/sales/leads/${lead.id}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {lead.prospect.name}
                      </Link>{" "}
                      {lead.prospect.domain ? (
                        <span className="text-sm text-slate-400">
                          {lead.prospect.domain}
                        </span>
                      ) : null}
                      {lead.lostReason ? (
                        <p className="mt-1 text-xs text-slate-500">
                          {lead.lostReason}
                        </p>
                      ) : null}
                      {lead.ownerNote ? (
                        <p className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs whitespace-pre-wrap text-slate-700">
                          {lead.ownerNote}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-slate-400">
                        {lead.score ?? "—"}
                      </p>
                      <p className="text-xs font-medium text-red-600">
                        Zamítnutá
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Nastavení kampaně
          </h2>
          <CampaignSettingsForm
            campaign={{
              id: campaign.id,
              name: campaign.name,
              mission: campaign.mission,
              segment: campaign.segment,
              geography: campaign.geography,
              dailyLimit: campaign.dailyLimit,
              minScore: campaign.minScore,
              schedule: campaign.schedule,
            }}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Běhy</h2>

          <StartRunForm
            campaignId={campaign.id}
            disabled={campaign.status !== "ACTIVE" || hasLiveRun}
            disabledReason={
              campaign.status !== "ACTIVE"
                ? "Kampaň není aktivní."
                : hasLiveRun
                  ? "Jeden běh už právě probíhá."
                  : undefined
            }
          />

          {campaign.runs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Zatím žádný běh. Scout začne hledat po prvním spuštění.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {campaign.runs.map((run) => (
                <li key={run.id}>
                  <Link
                    scroll={false}
                    href={`/sales/runs/${run.id}`}
                    className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 transition hover:bg-slate-100"
                  >
                    <span className="text-slate-700">
                      {RUN_LABELS[run.status] ?? run.status}
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDateTime(run.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-medium text-slate-900">
            Agenti a jejich prompty
          </h2>
          <p className="text-sm text-slate-500">
            Stabilní identita a pravidla každého agenta. Mise se do promptu
            přidává zvlášť za běhu. Každé uložení vytvoří novou verzi, běhy si
            pamatují, na které verzi jely.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {prompts.map(({ agent, prompt }) => (
            <section
              key={agent}
              className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {AGENT_INFO[agent].name}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {AGENT_INFO[agent].role}
                </p>
              </div>
              <PromptEditor
                agent={agent}
                agentName={AGENT_INFO[agent].name}
                system={prompt.system}
                version={prompt.version}
              />
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}

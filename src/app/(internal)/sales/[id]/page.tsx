import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignSettingsForm } from "@/components/sales/campaign-settings-form";
import { CampaignStatusField } from "@/components/sales/campaign-status-field";
import { PromptEditor } from "@/components/sales/prompt-editor";
import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { AGENT_INFO, SALES_AGENTS } from "@/lib/sales/agents";
import { getActivePrompt } from "@/lib/sales/prompts";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Kampaň — Mitsov Web",
};

export default async function CampaignPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await props.params;

  const campaign = await prisma.salesCampaign.findUnique({
    where: { id },
    include: {
      runs: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { leads: true } },
    },
  });

  if (!campaign) notFound();

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
              {campaign._count.leads} leadů celkem
            </p>
          </div>
          <CampaignStatusField campaignId={campaign.id} status={campaign.status} />
        </div>
      </div>

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
            }}
          />
        </section>

        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Běhy</h2>

          {campaign.runs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Zatím žádný běh. Spouštění přijde s Scoutem v další etapě — teď
              se ladí zadání: mise, limity a prompty agentů.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {campaign.runs.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="text-slate-700">{run.status}</span>
                  <span className="text-xs text-slate-500">
                    {formatDateTime(run.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="font-medium text-slate-900">Agenti a jejich prompty</h2>
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

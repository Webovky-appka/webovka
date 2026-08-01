import Link from "next/link";

import { NewCampaignForm } from "@/components/sales/new-campaign-form";
import { CampaignStatusField } from "@/components/sales/campaign-status-field";
import { requireUser } from "@/lib/auth";
import { pluralCs } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "AI Sales — Mitsov Web",
};

export default async function SalesPage() {
  await requireUser();

  const campaigns = await prisma.salesCampaign.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { leads: true, runs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          AI Sales
        </h1>
        <p className="text-sm text-slate-500">
          Tým agentů na hledání nových klientů. Kampaň říká, co se hledá;
          agenti připraví leady a vy je schválíte.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Nová kampaň</h2>
          <p className="mt-1 text-xs text-slate-500">
            Segment, oblast a mise. Scout začne pracovat, až kampaň spustíte —
            spouštění běhů přijde v další etapě.
          </p>
        </div>
        <NewCampaignForm />
      </section>

      {campaigns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
          Zatím žádná kampaň. Založte první — třeba restaurace v okolí se
          zastaralým webem.
        </p>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((campaign) => (
            <li
              key={campaign.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
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
                <CampaignStatusField
                  campaignId={campaign.id}
                  status={campaign.status}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">
                {campaign._count.leads}{" "}
                {pluralCs(campaign._count.leads, "lead", "leady", "leadů")} ·{" "}
                {campaign._count.runs}{" "}
                {pluralCs(campaign._count.runs, "běh", "běhy", "běhů")} · limit{" "}
                {campaign.dailyLimit}/den · minimální skóre {campaign.minScore}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

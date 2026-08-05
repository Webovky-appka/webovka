import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import {
  dedupeDecision,
  isSharedPlatformDomain,
  normalizeDomain,
} from "@/lib/sales/dedupe";
import { fetchSiteSummary } from "@/lib/sales/fetch-site";
import { callAgentModel } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";

/**
 * Scout ve dvou levných krocích (sekce 7.1 specifikace): broad search přes
 * web search najde kandidáty, kvalifikace bez nástrojů je obodujе. Hluboký
 * audit patří Auditorovi a dělá se až u kvalifikovaných leadů.
 */

const DiscoverSchema = z.object({
  candidates: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string(),
      location: z.string(),
      industry: z.string(),
      reason: z.string(),
      signals: z.array(z.string()),
    }),
  ),
  summary: z.string(),
});

const DISCOVER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates", "summary"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "url", "location", "industry", "reason", "signals"],
        properties: {
          name: { type: "string" },
          url: {
            type: "string",
            description:
              "Adresa webu firmy. U firem bez vlastního webu plná adresa jejich stránky (např. facebook.com/nazevpodniku), pokud ji z vyhledávání skutečně znáš; jinak prázdný řetězec. NIKDY si adresu nevymýšlej a nikdy nepiš jen doménu platformy.",
          },
          location: { type: "string" },
          industry: { type: "string" },
          reason: {
            type: "string",
            description: "Proč je firma vhodný kandidát, s odkazem na evidenci",
          },
          signals: {
            type: "array",
            items: { type: "string" },
            description: "Ověřitelné signály: hodnocení, počet recenzí, stáří webu…",
          },
        },
      },
    },
    summary: { type: "string", description: "Stručný pracovní report hledání" },
  },
} as const;

const QualifySchema = z.object({
  businessScore: z.number().int().min(0).max(100),
  websiteScore: z.number().int().min(0).max(100),
  score: z.number().int().min(0).max(100),
  reason: z.string(),
  summary: z.string(),
  confidence: z.number().min(0).max(1),
});

const QUALIFY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessScore",
    "websiteScore",
    "score",
    "reason",
    "summary",
    "confidence",
  ],
  properties: {
    businessScore: {
      type: "integer",
      description: "Kvalita a síla firmy 0–100",
    },
    websiteScore: {
      type: "integer",
      description: "Kvalita současného webu 0–100 (vyšší = lepší web)",
    },
    score: {
      type: "integer",
      description: "Celkové skóre obchodní příležitosti 0–100",
    },
    reason: {
      type: "string",
      description: "Proč firmu oslovit, s konkrétní evidencí",
    },
    summary: { type: "string" },
    confidence: { type: "number" },
  },
} as const;

export type DiscoverOutcome = {
  ok: boolean;
  error?: string;
  inspected: number;
  createdLeadIds: string[];
  skipped: { name: string; reason: string }[];
  summary?: string;
};

/** Kolik kandidátů si říct modelu: násobek limitu, ale s rozumným stropem. */
function candidateTarget(campaign: SalesCampaign): number {
  return Math.min(campaign.dailyLimit * 3, 15);
}

export async function discoverCandidates(options: {
  campaign: SalesCampaign;
  runId: string;
}): Promise<DiscoverOutcome> {
  const { campaign, runId } = options;
  const prompt = await getActivePrompt("scout");

  const mission = [
    `Mise kampaně: ${campaign.mission}`,
    campaign.segment ? `Segment: ${campaign.segment}` : null,
    campaign.geography ? `Oblast: ${campaign.geography}` : null,
    "",
    `Najdi pomocí vyhledávání na webu nejvýš ${candidateTarget(campaign)} firem,`,
    "které odpovídají misi. Pro každou uveď skutečnou adresu jejího webu.",
    "Firmy bez vlastního webu jsou nejcennější kandidáti — u nich uveď plnou",
    "adresu jejich stránky (např. facebook.com/nazevpodniku nebo",
    "instagram.com/ucet), pokud jsi ji vyhledáváním skutečně našel; když ji",
    "neznáš, nech url prázdné a firmu přesto uveď. Adresu si NIKDY nevymýšlej",
    "a nikdy nepiš jen samotnou doménu platformy. U každé napiš, proč je",
    "vhodným kandidátem, a ověřitelné signály (hodnocení, počet recenzí,",
    "stáří webu, aktivita).",
    "Nevymýšlej si — uváděj jen firmy, které jsi vyhledáváním skutečně našel.",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const result = await callAgentModel({
    task: "scout-discover",
    agent: "scout",
    system: prompt.system,
    input: mission,
    schemaName: "scout_candidates",
    jsonSchema: DISCOVER_JSON_SCHEMA,
    zodSchema: DiscoverSchema,
    useWebSearch: true,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
  });

  if (!result.ok) {
    return { ok: false, error: result.error, inspected: 0, createdLeadIds: [], skipped: [] };
  }

  // Stávající klienti se neoslovují nikdy — poznávají se podle domény webu
  // a u firem bez webu aspoň podle jména.
  const clients = await prisma.client.findMany({
    select: { website: true, companyName: true },
  });
  const clientDomains = new Set(
    clients
      .map((client) => normalizeDomain(client.website))
      .filter((domain): domain is string => domain !== null),
  );
  const clientNames = new Set(
    clients.map((client) => client.companyName.trim().toLowerCase()),
  );

  const createdLeadIds: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const seenInRun = new Set<string>();

  for (const candidate of result.data.candidates) {
    const domain = normalizeDomain(candidate.url);
    const key = domain ?? candidate.name.trim().toLowerCase();

    if (seenInRun.has(key)) {
      skipped.push({ name: candidate.name, reason: "duplicitní v tomto běhu" });
      continue;
    }
    seenInRun.add(key);

    // Firma bez použitelné adresy se zakládá s prázdnou doménou — bez webu
    // není co auditovat, ale obchodně je to nejcennější kandidát. Dedup
    // se u ní dělá podle jména, doména jinak zůstává primárním klíčem.
    const existing = domain
      ? await prisma.prospect.findUnique({
          where: { domain },
          include: { leads: { select: { status: true, updatedAt: true } } },
        })
      : await prisma.prospect.findFirst({
          where: {
            name: { equals: candidate.name.trim(), mode: "insensitive" },
          },
          include: { leads: { select: { status: true, updatedAt: true } } },
        });

    const decision = dedupeDecision({
      isClient: domain
        ? clientDomains.has(domain)
        : clientNames.has(candidate.name.trim().toLowerCase()),
      existingLeads: existing?.leads ?? [],
    });

    if (decision.action === "skip") {
      skipped.push({ name: candidate.name, reason: decision.reason });
      continue;
    }

    const prospect =
      existing ??
      (await prisma.prospect.create({
        data: {
          name: candidate.name,
          domain,
          industry: candidate.industry,
          location: candidate.location,
        },
      }));

    const lead = await prisma.salesLead.create({
      data: {
        prospectId: prospect.id,
        campaignId: campaign.id,
        status: "DISCOVERED",
        reason: candidate.reason,
      },
      select: { id: true },
    });

    await prisma.salesActivity.create({
      data: {
        prospectId: prospect.id,
        leadId: lead.id,
        actor: "scout",
        kind: "discovered",
        body: candidate.reason,
        meta: { runId, signals: candidate.signals },
      },
    });

    createdLeadIds.push(lead.id);
  }

  return {
    ok: true,
    inspected: result.data.candidates.length,
    createdLeadIds,
    skipped,
    summary: result.data.summary,
  };
}

export type QualifyOutcome =
  | { ok: true; status: "QUALIFIED" | "REJECTED" | "OVER_LIMIT"; score: number }
  | { ok: false; error: string };

export async function qualifyLead(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
  qualifiedSoFar: number;
}): Promise<QualifyOutcome> {
  const { leadId, campaign, runId, qualifiedSoFar } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: { prospect: true },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };

  // Firma jen se stránkou na sdílené platformě vlastní web nemá — není co
  // stahovat (platformy fetch blokují) a hodnotí se síla podniku ze signálů.
  const noOwnWebsite =
    !lead.prospect.domain || isSharedPlatformDomain(lead.prospect.domain);
  const site =
    !noOwnWebsite && lead.prospect.domain
      ? await fetchSiteSummary(lead.prospect.domain)
      : null;

  const prompt = await getActivePrompt("scout");

  const input = [
    `Kvalifikuj kandidáta pro misi: ${campaign.mission}`,
    "",
    `Firma: ${lead.prospect.name}`,
    `Obor: ${lead.prospect.industry ?? "neznámý"}`,
    `Místo: ${lead.prospect.location ?? "neznámé"}`,
    noOwnWebsite
      ? `Web: NEMÁ vlastní${lead.prospect.domain ? ` — jen stránku ${lead.prospect.domain}` : ""}`
      : `Web: ${lead.prospect.domain ?? "neznámý"}`,
    `Proč byl kandidát vybrán: ${lead.reason ?? "bez důvodu"}`,
    "",
    noOwnWebsite
      ? [
          "Firma nemá vlastní web, jen stránku na sdílené platformě.",
          "websiteScore dej 0–15 (vlastní web neexistuje). businessScore posuď",
          "ze signálů z vyhledávání (hodnocení, recenze, aktivita). Silný podnik",
          "bez webu je pro nás nejlepší možná příležitost — stavíme první web.",
        ].join("\n")
      : site
        ? [
            "Co je vidět na homepage:",
            `Titulek: ${site.title ?? "chybí"}`,
            `Popis: ${site.description ?? "chybí"}`,
            site.headings.length > 0
              ? `Nadpisy: ${site.headings.join(" | ")}`
              : "Nadpisy: žádné",
            `Výňatek textu: ${site.excerpt}`,
          ].join("\n")
        : "Web se nepodařilo načíst — hodnoť s nižší confidence a napiš to do reason.",
    "",
    "Oboduj: businessScore = síla a věrohodnost firmy, websiteScore = kvalita",
    "současného webu (vyšší číslo znamená lepší web), score = celková obchodní",
    "příležitost. Nejlepší příležitost je silná firma se slabým webem — nebo",
    "úplně bez něj.",
  ].join("\n");

  const result = await callAgentModel({
    task: "scout-qualify",
    agent: "scout",
    system: prompt.system,
    input,
    schemaName: "scout_qualification",
    jsonSchema: QUALIFY_JSON_SCHEMA,
    zodSchema: QualifySchema,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const { score, businessScore, websiteScore, reason, confidence } = result.data;

  const belowThreshold = score < campaign.minScore;
  const overLimit = !belowThreshold && qualifiedSoFar >= campaign.dailyLimit;

  // Nad denní limit zůstává lead objevený — dobrá firma se nezamítá jen proto,
  // že se do dnešního limitu nevešla.
  const status = belowThreshold
    ? "REJECTED"
    : overLimit
      ? "DISCOVERED"
      : "QUALIFIED";

  await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      status,
      score,
      businessScore,
      websiteScore,
      opportunityGap: businessScore - websiteScore,
      reason,
    },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "scout",
      kind: belowThreshold ? "rejected" : overLimit ? "over_limit" : "qualified",
      body: belowThreshold
        ? `Zamítnuto, skóre ${score} je pod hranicí ${campaign.minScore}. ${reason}`
        : overLimit
          ? `Skóre ${score}, ale denní limit ${campaign.dailyLimit} už je naplněný — zůstává v zásobníku.`
          : `Kvalifikováno se skóre ${score} (firma ${businessScore}, web ${websiteScore}, gap ${businessScore - websiteScore}).`,
      meta: { runId, confidence },
    },
  });

  return {
    ok: true,
    status: belowThreshold ? "REJECTED" : overLimit ? "OVER_LIMIT" : "QUALIFIED",
    score,
  };
}

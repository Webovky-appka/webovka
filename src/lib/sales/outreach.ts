import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
import {
  buildSampleBlock,
  MAX_SAMPLES,
  type EmailSample,
} from "@/lib/sales/email-samples";
import type { EvidenceItem } from "@/lib/sales/evidence";
import { callAgentModel } from "@/lib/sales/model";
import {
  buildOutreachInput,
  OUTREACH_STRATEGIES,
} from "@/lib/sales/outreach-input";
import { getActivePrompt } from "@/lib/sales/prompts";
import { parseResearchHooks } from "@/lib/sales/research-hooks";

/**
 * Outreach (sekce 13 specifikace): z leadu s auditem a kontaktem složí návrh
 * prvního e-mailu. Návrh NIKDY neodchází sám — lead končí ve stavu
 * READY_FOR_REVIEW a o odeslání rozhoduje člověk (sekce 14).
 */

const DraftSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(50),
  strategy: z.enum(OUTREACH_STRATEGIES),
  summary: z.string(),
});

const DRAFT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body", "strategy", "summary"],
  properties: {
    subject: {
      type: "string",
      description: "Předmět e-mailu, česky, věcný, bez clickbaitu",
    },
    body: {
      type: "string",
      description:
        "Tělo e-mailu včetně oslovení a podpisu, 120–180 slov, bez věty o odmítnutí",
    },
    strategy: { type: "string", enum: [...OUTREACH_STRATEGIES] },
    summary: { type: "string", description: "Jedna věta: jaký hook a proč" },
  },
} as const;

type Findings = {
  problems?: { title: string; explanation: string; severity: string }[];
  recommendation?: string;
  evidence?: EvidenceItem[];
};

export type OutreachOutcome =
  | { ok: true; strategy: string }
  | { ok: false; error: string };

/** Zapnuté vzory z Nastavení, nejnovější první. */
async function activeSamples(): Promise<EmailSample[]> {
  return prisma.salesEmailSample.findMany({
    where: { active: true },
    orderBy: { updatedAt: "desc" },
    take: MAX_SAMPLES,
    select: { label: true, subject: true, body: true, note: true },
  });
}

export async function draftOutreach(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
  senderName: string;
}): Promise<OutreachOutcome> {
  const { leadId, campaign, runId, senderName } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: {
      prospect: { include: { contacts: true } },
      audits: { orderBy: { createdAt: "desc" }, take: 1 },
      emails: { where: { status: "DRAFT" }, select: { id: true } },
    },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };

  // Doménu známe, ale audit nevznikl — web se nepodařilo načíst. E-mail se
  // pak opře o samotnou nedostupnost a o webu nic dalšího netvrdí.
  const siteUnreachable =
    lead.audits.length === 0 &&
    lead.prospect.domain !== null &&
    !isSharedPlatformDomain(lead.prospect.domain);

  // Existující koncept se nepřepisuje — idempotence při opakovaném ticku.
  if (lead.emails.length > 0) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { status: "READY_FOR_REVIEW" },
    });
    return { ok: true, strategy: "existing" };
  }

  const findings = (lead.audits[0]?.findings ?? {}) as Findings;
  const contact =
    lead.prospect.contacts.find((item) => item.isPrimary) ??
    lead.prospect.contacts[0] ??
    null;

  const prompt = await getActivePrompt("outreach");

  const input = buildOutreachInput({
    companyName: lead.prospect.name,
    domain: lead.prospect.domain,
    industry: lead.prospect.industry,
    location: lead.prospect.location,
    reason: lead.reason,
    mission: campaign.mission,
    contact: contact ? { name: contact.name, role: contact.role } : null,
    problems: findings.problems ?? [],
    recommendation: findings.recommendation ?? null,
    evidence: findings.evidence ?? [],
    researchHooks: parseResearchHooks(lead.research),
    siteUnreachable,
    hasMockup: lead.mockupKey !== null,
    samples: await activeSamples(),
    senderName,
  });

  const result = await callAgentModel({
    task: "outreach",
    agent: "outreach",
    system: prompt.system,
    input,
    schemaName: "outreach_draft",
    jsonSchema: DRAFT_JSON_SCHEMA,
    zodSchema: DraftSchema,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  await prisma.salesEmailDraft.create({
    data: {
      leadId,
      subject: result.data.subject,
      body: result.data.body,
      strategy: result.data.strategy,
      promptVersionId: prompt.versionId,
    },
  });

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: "READY_FOR_REVIEW" },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "outreach",
      kind: "draft",
      body: `Návrh e-mailu připraven (strategie ${result.data.strategy}). ${result.data.summary}`,
      meta: { runId },
    },
  });

  return { ok: true, strategy: result.data.strategy };
}

const RefineSchema = z.object({
  subject: z.string().min(1).max(120),
  body: z.string().min(50),
  summary: z.string(),
});

const REFINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "body", "summary"],
  properties: {
    subject: { type: "string", description: "Upravený předmět e-mailu" },
    body: {
      type: "string",
      description:
        "Upravené tělo e-mailu včetně oslovení a podpisu",
    },
    summary: { type: "string", description: "Jedna věta: co se změnilo" },
  },
} as const;

/**
 * Přepíše rozepsaný návrh podle pokynu uživatele (review, sekce 14).
 * Anti-halucinační hranice zůstává: úprava nesmí přidat žádné nové faktické
 * tvrzení o firmě — smí jen přeskládat a přeformulovat to, co v návrhu už je.
 */
export async function refineDraft(options: {
  draftId: string;
  instruction: string;
  userName: string;
  userId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const draft = await prisma.salesEmailDraft.findUnique({
    where: { id: options.draftId },
    include: {
      lead: {
        select: {
          id: true,
          campaignId: true,
          prospectId: true,
          prospect: { select: { name: true } },
        },
      },
    },
  });
  if (!draft) return { ok: false, error: "Návrh nenalezen." };
  if (draft.status !== "DRAFT") {
    return { ok: false, error: "Upravit jde jen neodeslaný návrh." };
  }

  const prompt = await getActivePrompt("outreach");

  const input = [
    `Uprav rozepsaný e-mail pro firmu ${draft.lead.prospect.name} podle pokynu uživatele.`,
    "",
    `Pokyn uživatele: ${options.instruction}`,
    "",
    `Aktuální předmět: ${draft.subject}`,
    "",
    "Aktuální text:",
    draft.body,
    "",
    ...buildSampleBlock(await activeSamples()),
    "Pravidla úpravy:",
    "- Vyhov pokynu, ale drž pravidla své identity (tón, vykání, rozsah).",
    "- NESMÍŠ přidat žádné nové faktické tvrzení o firmě, které v aktuálním textu není.",
    "- Zachovej právě jeden podpis.",
    "- Pokud text obsahuje větu o možnosti odmítnutí („stačí odpovědět a už se neozveme“ apod.), odstraň ji.",
  ].join("\n");

  const result = await callAgentModel({
    task: "outreach",
    agent: "outreach",
    system: prompt.system,
    input,
    schemaName: "outreach_refine",
    jsonSchema: REFINE_JSON_SCHEMA,
    zodSchema: RefineSchema,
    promptVersionId: prompt.versionId,
    campaignId: draft.lead.campaignId,
    leadId: draft.lead.id,
  });
  if (!result.ok) return { ok: false, error: result.error };

  // Verze PŘED úpravou se schová i s pokynem, který ji vystřídal — z toho
  // je pak historie a tlačítko Zpět.
  await prisma.salesEmailRevision.create({
    data: {
      draftId: draft.id,
      subject: draft.subject,
      body: draft.body,
      instruction: options.instruction,
      createdById: options.userId ?? null,
    },
  });

  await prisma.salesEmailDraft.update({
    where: { id: draft.id },
    data: { subject: result.data.subject, body: result.data.body },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: draft.lead.prospectId,
      leadId: draft.lead.id,
      actor: "outreach",
      kind: "draft",
      body: `${options.userName} nechal návrh upravit AI: „${options.instruction.slice(0, 120)}“. ${result.data.summary}`,
    },
  });

  return { ok: true };
}

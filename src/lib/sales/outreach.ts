import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import type { EvidenceItem } from "@/lib/sales/evidence";
import { callAgentModel } from "@/lib/sales/model";
import {
  buildOutreachInput,
  OUTREACH_STRATEGIES,
} from "@/lib/sales/outreach-input";
import { getActivePrompt } from "@/lib/sales/prompts";

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
        "Tělo e-mailu včetně oslovení a podpisu, pod 110 slov, s větou o možnosti odmítnutí",
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

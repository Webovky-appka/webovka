import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { EVIDENCE_KINDS } from "@/lib/sales/evidence";
import { fetchAuditContent } from "@/lib/sales/fetch-site";
import { callAgentModel, type AgentImage } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";
import { captureAndStore } from "@/lib/sales/screenshot";
import { VISUAL_DIMENSIONS } from "@/lib/sales/visual";

/**
 * Auditor: hluboké hodnocení webu kvalifikovaného leadu (sekce 9 specifikace).
 * Pracuje z HTML a ze screenshotů (desktop + mobil, sekce 9.2) — vidí tedy
 * skutečně vyrenderovaný web. Když se screenshoty nepovedou, běží jen z HTML
 * a vizuální dojmy musí být označené jako úsudek, ne vydávané za pozorování.
 */

const ProblemSchema = z.object({
  title: z.string().min(1),
  explanation: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]),
});

const dimensionScore = z.number().int().min(0).max(10);

/** Rozpad vizuálu po dimenzích (sekce 9.1). Klíče drží VISUAL_DIMENSIONS. */
const VisualSchema = z.object({
  typography: dimensionScore,
  layout: dimensionScore,
  spacing: dimensionScore,
  visualHierarchy: dimensionScore,
  photography: dimensionScore,
  colorSystem: dimensionScore,
  brandConsistency: dimensionScore,
  ctaPresentation: dimensionScore,
  mobilePresentation: dimensionScore,
  perceivedModernity: dimensionScore,
});

export const VISUAL_SCHEMA_KEYS = Object.keys(VisualSchema.shape);

const AuditSchema = z.object({
  visual: VisualSchema,
  visualScore: z.number().int().min(0).max(100),
  uxScore: z.number().int().min(0).max(100),
  mobileScore: z.number().int().min(0).max(100),
  conversionScore: z.number().int().min(0).max(100),
  seoScore: z.number().int().min(0).max(100),
  finalScore: z.number().int().min(0).max(100),
  strengths: z.array(z.string()),
  problems: z.array(ProblemSchema),
  opportunities: z.array(z.string()),
  recommendation: z.string().min(1),
  evidence: z.array(
    z.object({
      claim: z.string().min(1),
      kind: z.enum(EVIDENCE_KINDS),
      source: z.string(),
    }),
  ),
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export type AuditResult = z.infer<typeof AuditSchema>;

const AUDIT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "visual",
    "visualScore",
    "uxScore",
    "mobileScore",
    "conversionScore",
    "seoScore",
    "finalScore",
    "strengths",
    "problems",
    "opportunities",
    "recommendation",
    "evidence",
    "summary",
    "confidence",
  ],
  properties: {
    visual: {
      type: "object",
      additionalProperties: false,
      required: VISUAL_DIMENSIONS.map((dimension) => dimension.key),
      description:
        "Rozpad vizuálu 0–10 po dimenzích (0 = katastrofa, 10 = špička). Ze screenshotů; bez nich odhad z HTML.",
      properties: Object.fromEntries(
        VISUAL_DIMENSIONS.map((dimension) => [
          dimension.key,
          { type: "integer", description: `${dimension.label} 0–10` },
        ]),
      ),
    },
    visualScore: {
      type: "integer",
      description: "Vizuální kvalita webu 0–100 (vyšší = lepší web)",
    },
    uxScore: { type: "integer", description: "Použitelnost a navigace 0–100" },
    mobileScore: {
      type: "integer",
      description: "Mobilní použitelnost 0–100, z HTML jen odhad",
    },
    conversionScore: {
      type: "integer",
      description: "CTA a konverzní cesta 0–100",
    },
    seoScore: { type: "integer", description: "Základní SEO 0–100" },
    finalScore: {
      type: "integer",
      description:
        "Výsledné skóre obchodní příležitosti 0–100 podle rubriky — vyšší = lepší lead pro redesign",
    },
    strengths: { type: "array", items: { type: "string" } },
    problems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "explanation", "severity"],
        properties: {
          title: { type: "string" },
          explanation: {
            type: "string",
            description: "Konkrétně: co přesně a kde, ne obecné fráze",
          },
          severity: { type: "string", enum: ["low", "medium", "high"] },
        },
      },
    },
    opportunities: { type: "array", items: { type: "string" } },
    recommendation: {
      type: "string",
      description: "Hlavní doporučení pro redesign, jedno až dvě souvětí",
    },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "kind", "source"],
        properties: {
          claim: { type: "string" },
          kind: { type: "string", enum: [...EVIDENCE_KINDS] },
          source: {
            type: "string",
            description: "Odkud tvrzení pochází (část webu, výpočet, úsudek)",
          },
        },
      },
    },
    summary: { type: "string" },
    confidence: { type: "number" },
  },
} as const;

export type AuditOutcome =
  | { ok: true; finalScore: number }
  | { ok: false; error: string };

export async function auditLead(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
}): Promise<AuditOutcome> {
  const { leadId, campaign, runId } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: { prospect: true },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };
  if (!lead.prospect.domain) {
    return { ok: false, error: "Lead nemá doménu, není co auditovat." };
  }

  const content = await fetchAuditContent(lead.prospect.domain);
  if (!content) {
    return {
      ok: false,
      error: `Web ${lead.prospect.domain} se nepodařilo načíst.`,
    };
  }

  // Screenshoty jsou nejlepší snaha — bez nich audit poběží jen z HTML.
  // Fotí se finální URL po přesměrováních, stejná, ze které je HTML.
  const shots = await captureAndStore(leadId, content.finalUrl);
  if (shots) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: {
        screenshotDesktopKey: shots.desktopKey,
        screenshotMobileKey: shots.mobileKey,
        screenshotAt: new Date(),
      },
    });
  }

  const images: AgentImage[] = shots
    ? [
        {
          label: "screenshot desktop 1440×900",
          data: shots.capture.desktop,
          mimeType: "image/jpeg",
        },
        {
          label: "screenshot mobil 390×844",
          data: shots.capture.mobile,
          mimeType: "image/jpeg",
        },
      ]
    : [];

  const prompt = await getActivePrompt("auditor");

  const evidenceRules = shots
    ? [
        "Proveď audit podle svých pravidel. Pamatuj:",
        "- Přiložené jsou screenshoty: první desktop (1440×900), druhý mobil (390×844).",
        "- Co je na screenshotu vidět (rozložení, chybějící CTA, malé fotografie), je OBSERVED se zdrojem „screenshot desktop“ nebo „screenshot mobil“.",
        "- Estetický dojem (zastaralost, elegance) zůstává AI_JUDGMENT, i když vychází ze screenshotu.",
      ]
    : [
        "Proveď audit podle svých pravidel. Pamatuj:",
        "- Vidíš jen HTML, screenshoty se nepodařily. Co je vizuální dojem, označ v evidence jako AI_JUDGMENT a sniž confidence.",
      ];

  const input = [
    `Firma: ${lead.prospect.name} (${lead.prospect.industry ?? "obor neznámý"}, ${lead.prospect.location ?? "místo neznámé"})`,
    `Proč je v pipeline: ${lead.reason ?? "bez důvodu"}`,
    `Skóre z kvalifikace: ${lead.score ?? "—"} (firma ${lead.businessScore ?? "—"}, web ${lead.websiteScore ?? "—"})`,
    "",
    `Podklady z webu ${content.finalUrl}${shots ? "" : " (jen HTML, bez vykreslení)"}:`,
    `Titulek: ${content.title ?? "chybí"}`,
    `Meta description: ${content.description ?? "chybí"}`,
    `Viewport meta: ${content.hasViewportMeta ? "ano" : "chybí — silný signál špatného mobilu"}`,
    `Obrázky: ${content.imageCount}, z toho s alt textem ${content.imagesWithAlt}`,
    `Formuláře: ${content.formCount}`,
    `Navigace a odkazy: ${content.navLinks.join(" | ") || "žádné"}`,
    `Nadpisy: ${content.headings.join(" | ") || "žádné"}`,
    `Velikost HTML: ${Math.round(content.htmlBytes / 1024)} kB`,
    "",
    "Text webu:",
    content.excerpt,
    "",
    ...evidenceRules,
    "- Co je přímo v podkladech (chybějící viewport, počty, texty), je OBSERVED.",
    "- Co z pozorovaného vyplývá, je DERIVED. Co nevíš, je UNKNOWN — neskóruj to vysoko.",
    "- Rozpad visual: každou dimenzi ohodnoť 0–10 podle toho, co skutečně vidíš.",
    `- finalScore je obchodní příležitost pro redesign v kontextu mise: ${campaign.mission}`,
  ].join("\n");

  const result = await callAgentModel({
    task: "audit",
    agent: "auditor",
    system: prompt.system,
    input,
    schemaName: "website_audit",
    jsonSchema: AUDIT_JSON_SCHEMA,
    zodSchema: AuditSchema,
    images,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const audit = result.data;

  await prisma.salesAudit.create({
    data: {
      leadId,
      visualScore: audit.visualScore,
      uxScore: audit.uxScore,
      mobileScore: audit.mobileScore,
      conversionScore: audit.conversionScore,
      seoScore: audit.seoScore,
      findings: {
        strengths: audit.strengths,
        problems: audit.problems,
        opportunities: audit.opportunities,
        recommendation: audit.recommendation,
        evidence: audit.evidence,
        visual: audit.visual,
      },
      summary: audit.summary,
      confidence: audit.confidence,
    },
  });

  // Audit zpřesňuje skóre příležitosti — finální hodnota přepisuje kvalifikaci
  // (sekce 15 specky: „Auditor completed — Final score“).
  await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      score: audit.finalScore,
      websiteScore: audit.visualScore,
      opportunityGap:
        lead.businessScore !== null
          ? lead.businessScore - audit.visualScore
          : null,
    },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "auditor",
      kind: "audited",
      body: `Audit dokončen — výsledné skóre ${audit.finalScore}. ${audit.summary}`,
      meta: { runId, confidence: audit.confidence, screenshots: Boolean(shots) },
    },
  });

  return { ok: true, finalScore: audit.finalScore };
}

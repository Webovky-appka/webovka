import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
import { EVIDENCE_KINDS } from "@/lib/sales/evidence";
import { fetchAuditContent } from "@/lib/sales/fetch-site";
import { callAgentModel, type AgentImage } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";
import { captureAndStore, salesScreenshotKey } from "@/lib/sales/screenshot";
import { VISUAL_DIMENSIONS } from "@/lib/sales/visual";
import { readFile } from "@/lib/storage";

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
  /** Běh, který audit vyvolal. Null u ručního přeauditu z detailu. */
  runId: string | null;
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
  if (isSharedPlatformDomain(lead.prospect.domain)) {
    return {
      ok: false,
      error: "Firma nemá vlastní web — audit se přeskakuje.",
    };
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
        screenshotPages: shots.pages,
      },
    });
  }

  const images: AgentImage[] = shots
    ? [
        {
          label: "screenshot domovská stránka, desktop 1440×900",
          data: shots.capture.desktop,
          mimeType: "image/jpeg",
        },
        {
          label: "screenshot domovská stránka, mobil 390×844",
          data: shots.capture.mobile,
          mimeType: "image/jpeg",
        },
        ...shots.capture.extraPages.map((page) => ({
          label: `screenshot podstránky „${page.label}", desktop`,
          data: page.data,
          mimeType: "image/jpeg",
        })),
      ]
    : [];

  // Kalibrace lidskou laťkou: poslední weby ohodnocené majitelem studia se
  // přikládají jako vzorové snímky. Model má tendenci mačkat vše do středu
  // škály — příklady s lidskou známkou ho srovnávají s tím, kdo weby staví.
  const calibrationNotes: string[] = [];
  if (shots) {
    const rated = await prisma.salesLead.findMany({
      where: {
        humanWebScore: { not: null },
        screenshotDesktopKey: { not: null },
        id: { not: leadId },
      },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: {
        id: true,
        humanWebScore: true,
        websiteScore: true,
        prospect: { select: { name: true } },
      },
    });

    for (const example of rated) {
      try {
        const data = await readFile(salesScreenshotKey(example.id, "desktop"));
        images.push({
          label: `kalibrační příklad: ${example.prospect.name}`,
          data,
          mimeType: "image/jpeg",
        });
        calibrationNotes.push(
          `${calibrationNotes.length + 1}. ${example.prospect.name} — majitel studia hodnotí ${example.humanWebScore}/100${example.websiteScore !== null ? ` (dřívější odhad modelu ${example.websiteScore})` : ""}`,
        );
      } catch {
        // Snímek už v úložišti není — příklad se prostě vynechá.
      }
    }
  }

  const prompt = await getActivePrompt("auditor");

  const evidenceRules = shots
    ? [
        "Proveď audit podle svých pravidel. Pamatuj:",
        `- Přiložené screenshoty: domovská stránka desktop a mobil${shots.pages.length > 0 ? ` a ${shots.pages.length} podstránky (${shots.pages.map((page) => page.label).join(", ")})` : ""}.`,
        "- Co je na screenshotu vidět (rozložení, CTA, kvalita fotografií), je OBSERVED se zdrojem „screenshot …“.",
        "- Estetický dojem (zastaralost, elegance) zůstává AI_JUDGMENT, i když vychází ze screenshotu.",
        "- NIKDY netvrď, že něco chybí, dokud jsi to nezkontroloval na všech snímcích i v navigaci. Tlačítko „Rezervace“ na screenshotu znamená, že rezervace NEchybí. Když si nejsi jistý (funkce může být na podstránce, kterou nevidíš), označ to UNKNOWN a nedávej to do problems.",
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
    "",
    "Kalibrace skóre kvality webu (buď důrazný na obě strany):",
    "- 85–100: moderní, profesionální web bez zásadních vad. Takový web NEPŘEPÍŠEME lépe — přiznej to.",
    "- 70–84: solidní web, jen drobnosti. Redesign se těžko obhajuje.",
    "- 50–69: průměr se zjevnými slabinami, redesign má smysl.",
    "- 0–49: zastaralý nebo rozbitý web, redesign je jasný přínos.",
    "- Neschovávej se do středu škály. Hezký web dostane vysoký vizuál a NÍZKÉ finalScore — falešně nízké hodnocení znamená spam dobré firmě a ostudu studia.",
    `- finalScore je obchodní příležitost pro redesign v kontextu mise: ${campaign.mission}. Čím lepší web, tím NIŽŠÍ finalScore.`,
    ...(calibrationNotes.length > 0
      ? [
          "",
          `Vzory od majitele studia: ZA snímky auditovaného webu následuje ${calibrationNotes.length} kalibračních snímků jiných webů v tomto pořadí:`,
          ...calibrationNotes,
          "Jeho známka je závazná laťka — své hodnocení srovnej podle ní, ne podle obecného vkusu.",
        ]
      : []),
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

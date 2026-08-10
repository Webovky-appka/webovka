import "server-only";

import type { SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { callAgentModel, type AgentImage } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";
import {
  renderHtmlScreenshot,
  salesScreenshotKey,
  SCREENSHOT_CONTENT_TYPE,
} from "@/lib/sales/screenshot";
import { readFile, saveRawFile } from "@/lib/storage";

/**
 * Designer: u nejlepších příležitostí vygeneruje koncept nové homepage
 * (HTML → JPEG snímek) do přílohy prvního e-mailu. Jestli ukázka zvedá
 * odpovědi, se neví — proto experiment: příležitosti se skóre
 * MOCKUP_MIN_SCORE+ se náhodně dělí 50/50 na mockup a kontrolu bez něj.
 * Varianta se určuje jednou a zůstává, ať jsou skupiny srovnatelné.
 */

export const MOCKUP_MIN_SCORE = 75;

export const MOCKUP_VARIANTS = ["mockup", "none"] as const;
export type MockupVariant = (typeof MOCKUP_VARIANTS)[number];

const MockupSchema = z.object({
  html: z.string().min(500),
  notes: z.string(),
});

const MOCKUP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["html", "notes"],
  properties: {
    html: {
      type: "string",
      description:
        "Kompletní HTML dokument s inline CSS ve <style>. Bez externích zdrojů (obrázky, fonty, CDN). První obrazovka pro 1440×900.",
    },
    notes: {
      type: "string",
      description: "Jedna česká věta: co koncept zdůrazňuje a proč",
    },
  },
} as const;

export type DesignOutcome =
  | { ok: true; variant: MockupVariant; generated: boolean }
  | { ok: false; error: string };

/**
 * Rozhodne variantu experimentu a u varianty „mockup" koncept vygeneruje,
 * vyrenderuje a uloží. Idempotentní: hotový mockup se negeneruje znovu.
 */
export async function designLead(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
}): Promise<DesignOutcome> {
  const { leadId, campaign, runId } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: {
      prospect: true,
      audits: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };

  // Varianta se losuje právě jednou — při přeauditu nebo dalším běhu se
  // příležitost nesmí přesouvat mezi skupinami, jinak experiment nic neřekne.
  let variant = lead.mockupVariant as MockupVariant | null;
  if (variant === null) {
    variant = Math.random() < 0.5 ? "mockup" : "none";
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { mockupVariant: variant },
    });
    await prisma.salesActivity.create({
      data: {
        prospectId: lead.prospectId,
        leadId,
        actor: "designer",
        kind: "design",
        body:
          variant === "mockup"
            ? "Experiment: příležitost dostane koncept nové homepage do přílohy."
            : "Experiment: příležitost je v kontrolní skupině bez konceptu.",
        meta: { runId, variant },
      },
    });
  }

  if (variant === "none") return { ok: true, variant, generated: false };
  if (lead.mockupKey) return { ok: true, variant, generated: false };

  const findings = (lead.audits[0]?.findings ?? {}) as {
    recommendation?: string;
    problems?: { title: string }[];
  };

  const prompt = await getActivePrompt("designer");

  // Snímek současného webu dává modelu barvy a kontext značky. Bez něj
  // (firma bez webu) se navrhuje od nuly podle oboru.
  const images: AgentImage[] = [];
  if (lead.screenshotDesktopKey) {
    try {
      images.push({
        label: "současný web (desktop)",
        data: await readFile(lead.screenshotDesktopKey),
        mimeType: SCREENSHOT_CONTENT_TYPE,
      });
    } catch {
      // Chybějící soubor není důvod nevytvořit koncept.
    }
  }

  const input = [
    `Navrhni koncept nové homepage pro firmu: ${lead.prospect.name}`,
    `Obor a místo: ${lead.prospect.industry ?? "?"}, ${lead.prospect.location ?? "?"}`,
    lead.prospect.domain
      ? `Současný web: ${lead.prospect.domain}${images.length > 0 ? " — snímek je přiložený, vyjdi z jeho barev a obsahu" : ""}`
      : "Firma vlastní web nemá — tohle bude její první, navrhni od nuly podle oboru.",
    findings.recommendation
      ? `Doporučení z auditu: ${findings.recommendation}`
      : "",
    findings.problems?.length
      ? `Hlavní problémy současného webu (koncept je má řešit): ${findings.problems
          .slice(0, 3)
          .map((problem) => problem.title)
          .join(", ")}`
      : "",
    "",
    "Vrať kompletní HTML dokument první obrazovky (1440×900) podle pravidel své identity.",
  ]
    .filter((line) => line !== "")
    .join("\n");

  const result = await callAgentModel({
    task: "designer",
    agent: "designer",
    system: prompt.system,
    input,
    schemaName: "homepage_mockup",
    jsonSchema: MOCKUP_JSON_SCHEMA,
    zodSchema: MockupSchema,
    images,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const shot = await renderHtmlScreenshot(result.data.html);
  if (!shot) {
    return { ok: false, error: "Koncept se nepodařilo vyrenderovat." };
  }

  const key = salesScreenshotKey(leadId, "mockup");
  await saveRawFile(key, shot, SCREENSHOT_CONTENT_TYPE);

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { mockupKey: key, mockupAt: new Date() },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "designer",
      kind: "design",
      body: `Koncept nové homepage je připravený ke stažení. ${result.data.notes}`,
      meta: { runId },
    },
  });

  return { ok: true, variant, generated: true };
}

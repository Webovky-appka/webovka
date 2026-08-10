import "server-only";

import type { Prisma, SalesCampaign } from "@prisma/client";
import * as z from "zod";

import { prisma } from "@/lib/prisma";
import { EVIDENCE_KINDS } from "@/lib/sales/evidence";
import { callAgentModel } from "@/lib/sales/model";
import { getActivePrompt } from "@/lib/sales/prompts";
import {
  parseResearchHooks,
  RESEARCH_CATEGORIES,
} from "@/lib/sales/research-hooks";

/**
 * Company Research: web search po čerstvých háčcích o firmě — recenze,
 * novinky, sezónnost, nábory. Běží po dohledání kontaktů a před návrhem
 * e-mailu, aby měl Outreach na úvod něco lepšího než jen audit webu.
 *
 * Selhání není brzda: e-mail se napíše i bez háčků, research je bonus.
 * Prázdný výsledek se ukládá taky — je to informace, ne důvod opakovat.
 */

const ResearchSchema = z.object({
  hooks: z.array(
    z.object({
      claim: z.string().min(1),
      kind: z.enum(EVIDENCE_KINDS),
      source: z.string().min(1),
      category: z.enum(RESEARCH_CATEGORIES),
    }),
  ),
  summary: z.string(),
});

const RESEARCH_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["hooks", "summary"],
  properties: {
    hooks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "kind", "source", "category"],
        properties: {
          claim: {
            type: "string",
            description:
              "Jedna konkrétní česká věta — citace z recenze, název ocenění, co firma spustila",
          },
          kind: {
            type: "string",
            enum: [...EVIDENCE_KINDS],
            description:
              "OBSERVED = přímo přečteno, DERIVED = jednoznačně vyplývá, AI_JUDGMENT = dojem",
          },
          source: {
            type: "string",
            description:
              "Kde přesně to bylo nalezeno — adresa stránky nebo název zdroje. Bez zdroje háček nevracej.",
          },
          category: {
            type: "string",
            enum: [...RESEARCH_CATEGORIES],
            description:
              "recenze | novinka | sezona | nabor | oceneni | jine",
          },
        },
      },
    },
    summary: {
      type: "string",
      description: "Jedna věta: co se o firmě zjistilo, česky",
    },
  },
} as const;

export type ResearchOutcome =
  | { ok: true; hooks: number }
  | { ok: false; error: string };

export async function researchCompany(options: {
  leadId: string;
  campaign: SalesCampaign;
  runId: string;
}): Promise<ResearchOutcome> {
  const { leadId, campaign, runId } = options;

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: { prospect: true },
  });
  if (!lead) return { ok: false, error: "Lead nenalezen." };

  // Už proběhlý research se neopakuje — jen se spočítají uložené háčky.
  if (lead.researchAt) {
    return { ok: true, hooks: parseResearchHooks(lead.research).length };
  }

  const prompt = await getActivePrompt("research");

  const input = [
    `Zjisti aktuální informace o firmě: ${lead.prospect.name}`,
    `Web: ${lead.prospect.domain ?? "vlastní web neznáme"}`,
    `Obor a místo: ${lead.prospect.industry ?? "?"}, ${lead.prospect.location ?? "?"}`,
    "",
    "Hledej v tomhle pořadí:",
    "1. Recenze a hodnocení zákazníků (Google, Firmy.cz, Seznam) — vyber jednu konkrétní čerstvou.",
    "2. Novinky: zmínky v médiích, nové služby, otevření, rekonstrukce.",
    "3. Sezónnost podnikání — blíží se firmě hlavní sezóna?",
    "4. Nábory a růst (pracovní portály, kariérní stránky).",
    "5. Ocenění, certifikace, soutěže.",
    "",
    "Vrať nejvýš 5 háčků. Každý musí mít zdroj — bez zdroje ho vůbec nevracej.",
  ].join("\n");

  const result = await callAgentModel({
    task: "research",
    agent: "research",
    system: prompt.system,
    input,
    schemaName: "company_research",
    jsonSchema: RESEARCH_JSON_SCHEMA,
    zodSchema: ResearchSchema,
    useWebSearch: true,
    promptVersionId: prompt.versionId,
    runId,
    campaignId: campaign.id,
    leadId,
  });

  if (!result.ok) return { ok: false, error: result.error };

  // Stejné síto jako při čtení: háček bez zdroje nebo kategorie neprojde.
  const hooks = parseResearchHooks({ hooks: result.data.hooks });

  await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      research: {
        hooks,
        summary: result.data.summary,
      } as unknown as Prisma.InputJsonValue,
      researchAt: new Date(),
    },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "research",
      kind: "company_research",
      body:
        hooks.length === 0
          ? "Company research nenašel žádný použitelný háček — e-mail se opře o audit."
          : `Company research našel ${hooks.length} háčků. ${result.data.summary}`,
      meta: { runId },
    },
  });

  return { ok: true, hooks: hooks.length };
}

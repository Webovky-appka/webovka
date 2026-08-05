import "server-only";

import * as z from "zod";

import { callAgentModel } from "@/lib/sales/model";

/**
 * Dohledání fakturačních údajů firmy při zakládání zakázky z vyhrané
 * příležitosti. IČO a sídlo v prospektu nejsou — bez nich by nešla složit
 * smlouva. Web search v českých rejstřících (ARES, obchodní rejstřík);
 * co se nenajde s jistotou, zůstane prázdné — nikdy se nehádá.
 */

const DetailsSchema = z.object({
  ico: z.string().nullable(),
  address: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  source: z.string(),
});

const DETAILS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["ico", "address", "confidence", "source"],
  properties: {
    ico: {
      type: ["string", "null"],
      description: "IČO firmy (8 číslic), null když není jisté",
    },
    address: {
      type: ["string", "null"],
      description: "Sídlo/fakturační adresa, null když není jistá",
    },
    confidence: { type: "number" },
    source: { type: "string", description: "Odkud údaje pocházejí" },
  },
} as const;

const SYSTEM = [
  "Dohledáváš fakturační údaje české firmy pro webové studio.",
  "Hledej v ARES a obchodním rejstříku podle názvu a místa.",
  "NIKDY neodhaduj: když si nejsi jistý, že jde přesně o tuhle firmu,",
  "vrať null. Špatné IČO ve smlouvě je horší než žádné.",
].join("\n");

/** IČO má přesně 8 číslic — cokoli jiného se zahazuje. */
export function validIcoOrNull(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\s+/g, "");
  return /^\d{8}$/.test(digits) ? digits : null;
}

export async function lookupClientDetails(options: {
  companyName: string;
  location: string | null;
  domain: string | null;
  campaignId: string;
  leadId: string;
}): Promise<{ ico: string | null; address: string | null } | null> {
  const input = [
    `Firma: ${options.companyName}`,
    `Místo: ${options.location ?? "neznámé"}`,
    options.domain ? `Web/stránka: ${options.domain}` : "Bez webu.",
    "",
    "Najdi IČO a sídlo (fakturační adresu) této firmy.",
  ].join("\n");

  const result = await callAgentModel({
    task: "client-details",
    agent: "contact",
    system: SYSTEM,
    input,
    schemaName: "client_details",
    jsonSchema: DETAILS_JSON_SCHEMA,
    zodSchema: DetailsSchema,
    useWebSearch: true,
    campaignId: options.campaignId,
    leadId: options.leadId,
  });

  if (!result.ok) return null;

  // Pod polovinou jistoty raději nic — údaje jdou do smluv.
  if (result.data.confidence < 0.5) return { ico: null, address: null };

  return {
    ico: validIcoOrNull(result.data.ico),
    address: result.data.address,
  };
}

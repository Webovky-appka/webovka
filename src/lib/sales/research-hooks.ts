import { isEvidenceKind, type EvidenceKind } from "@/lib/sales/evidence";

/**
 * Háčky z Company Research — čistý modul bez server-only, protože typ
 * a parsování sdílí server (research, outreach podklady) i UI detailu
 * příležitosti. Háček bez zdroje neexistuje, stejně jako u kontaktů.
 */

export const RESEARCH_CATEGORIES = [
  "recenze",
  "novinka",
  "sezona",
  "nabor",
  "oceneni",
  "jine",
] as const;

export type ResearchCategory = (typeof RESEARCH_CATEGORIES)[number];

export const RESEARCH_CATEGORY_LABELS: Record<ResearchCategory, string> = {
  recenze: "Recenze",
  novinka: "Novinka",
  sezona: "Sezóna",
  nabor: "Nábor",
  oceneni: "Ocenění",
  jine: "Zajímavost",
};

export type ResearchHook = {
  claim: string;
  kind: EvidenceKind;
  source: string;
  category: ResearchCategory;
};

function isResearchCategory(value: unknown): value is ResearchCategory {
  return (
    typeof value === "string" &&
    (RESEARCH_CATEGORIES as readonly string[]).includes(value)
  );
}

/**
 * Bezpečné čtení háčků z JSON sloupce. Cokoli s neznámou kategorií nebo
 * bez zdroje se zahodí — radši žádný háček než tvrzení bez původu.
 */
export function parseResearchHooks(value: unknown): ResearchHook[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const hooks = (value as { hooks?: unknown }).hooks;
  if (!Array.isArray(hooks)) return [];

  return hooks.filter((hook): hook is ResearchHook => {
    if (!hook || typeof hook !== "object") return false;
    const item = hook as Record<string, unknown>;
    return (
      typeof item.claim === "string" &&
      item.claim.trim() !== "" &&
      typeof item.source === "string" &&
      item.source.trim() !== "" &&
      isEvidenceKind(item.kind) &&
      isResearchCategory(item.category)
    );
  });
}

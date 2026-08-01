/**
 * Klasifikace tvrzení v auditech a researchi (sekce 26 specifikace). Outreach
 * smí použít jen OBSERVED a DERIVED — úsudek modelu není fakt o firmě.
 * Čistý modul, používá ho server i UI.
 */

export const EVIDENCE_KINDS = [
  "OBSERVED",
  "DERIVED",
  "AI_JUDGMENT",
  "UNKNOWN",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const EVIDENCE_LABELS: Record<
  EvidenceKind,
  { label: string; hint: string }
> = {
  OBSERVED: {
    label: "Pozorováno",
    hint: "Přímo vidět na webu nebo ve zdroji — smí do e-mailu.",
  },
  DERIVED: {
    label: "Odvozeno",
    hint: "Vyplývá z pozorovaného (např. web bez viewportu ⇒ špatný na mobilu).",
  },
  AI_JUDGMENT: {
    label: "Úsudek AI",
    hint: "Hodnocení modelu, ne fakt — do e-mailu jen jako názor, ne tvrzení.",
  },
  UNKNOWN: {
    label: "Neznámé",
    hint: "Nepodařilo se zjistit. Nesmí se použít vůbec.",
  },
};

export type EvidenceItem = {
  claim: string;
  kind: EvidenceKind;
  source: string;
};

export function isEvidenceKind(value: unknown): value is EvidenceKind {
  return (
    typeof value === "string" &&
    (EVIDENCE_KINDS as readonly string[]).includes(value)
  );
}

/** Jen tvrzení použitelná v outreachi: pozorovaná a odvozená. */
export function usableInOutreach(items: EvidenceItem[]): EvidenceItem[] {
  return items.filter(
    (item) => item.kind === "OBSERVED" || item.kind === "DERIVED",
  );
}

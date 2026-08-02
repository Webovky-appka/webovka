/**
 * Vizuální dimenze auditu (sekce 9.1 specifikace). Agentura prodává vizuální
 * redesign, takže technicky rychlý web může být pořád skvělý lead — proto má
 * vizuál vlastní rozpad, ne jen jedno číslo.
 *
 * Bez server-only: labels potřebuje UI i testy.
 */
export const VISUAL_DIMENSIONS = [
  { key: "typography", label: "Typografie" },
  { key: "layout", label: "Layout" },
  { key: "spacing", label: "Vzdušnost" },
  { key: "visualHierarchy", label: "Vizuální hierarchie" },
  { key: "photography", label: "Fotografie" },
  { key: "colorSystem", label: "Barevný systém" },
  { key: "brandConsistency", label: "Konzistence značky" },
  { key: "ctaPresentation", label: "Prezentace CTA" },
  { key: "mobilePresentation", label: "Mobilní prezentace" },
  { key: "perceivedModernity", label: "Působí moderně" },
] as const;

export type VisualDimensionKey = (typeof VISUAL_DIMENSIONS)[number]["key"];

/** Skóre 0–10 pro každou dimenzi, jak je vrací auditor. */
export type VisualBreakdown = Record<VisualDimensionKey, number>;

export function isVisualBreakdown(value: unknown): value is VisualBreakdown {
  if (!value || typeof value !== "object") return false;
  return VISUAL_DIMENSIONS.every(
    (dimension) =>
      typeof (value as Record<string, unknown>)[dimension.key] === "number",
  );
}

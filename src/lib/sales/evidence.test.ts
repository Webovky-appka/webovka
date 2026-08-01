import { describe, expect, it } from "vitest";

import {
  EVIDENCE_KINDS,
  EVIDENCE_LABELS,
  isEvidenceKind,
  usableInOutreach,
} from "./evidence";

describe("klasifikace evidence", () => {
  it("každý druh má český popisek s nápovědou", () => {
    for (const kind of EVIDENCE_KINDS) {
      expect(EVIDENCE_LABELS[kind].label.length).toBeGreaterThan(2);
      expect(EVIDENCE_LABELS[kind].hint.length).toBeGreaterThan(10);
    }
  });

  it("pozná neplatný druh", () => {
    expect(isEvidenceKind("OBSERVED")).toBe(true);
    expect(isEvidenceKind("observed")).toBe(false);
    expect(isEvidenceKind(null)).toBe(false);
  });

  /**
   * Jádro sekce 26 specifikace: do outreache smí jen pozorované a odvozené.
   * Úsudek modelu není fakt o firmě a neznámé se nepoužívá vůbec.
   */
  it("do outreache pustí jen OBSERVED a DERIVED", () => {
    const filtered = usableInOutreach([
      { claim: "Web nemá viewport meta", kind: "OBSERVED", source: "HTML" },
      { claim: "Na mobilu bude špatně použitelný", kind: "DERIVED", source: "z chybějícího viewportu" },
      { claim: "Vizuál působí zastarale", kind: "AI_JUDGMENT", source: "úsudek" },
      { claim: "Majitel je Jan Novák", kind: "UNKNOWN", source: "" },
    ]);

    expect(filtered.map((item) => item.kind)).toEqual(["OBSERVED", "DERIVED"]);
  });
});

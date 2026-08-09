import { describe, expect, it } from "vitest";

import {
  buildOutreachInput,
  isOutreachStrategy,
  type OutreachFacts,
} from "./outreach-input";

function facts(overrides: Partial<OutreachFacts> = {}): OutreachFacts {
  return {
    companyName: "Kohout NA VÍNĚ",
    domain: "knvrestaurant.cz",
    industry: "restaurace",
    location: "Brno",
    reason: "Silná reputace, zastaralý web.",
    mission: "Restaurace v Brně se zastaralým webem.",
    contact: { name: "Jan Kohout", role: "majitel" },
    problems: [
      { title: "Slabé CTA", explanation: "Rezervace je schovaná.", severity: "medium" },
      { title: "Chybí viewport", explanation: "Web není responzivní.", severity: "high" },
      { title: "Drobnost", explanation: "Malé písmo v patičce.", severity: "low" },
    ],
    recommendation: "Fotografiemi vedený redesign s výraznou rezervací.",
    evidence: [
      { claim: "Web nemá viewport meta", kind: "OBSERVED", source: "HTML" },
      { claim: "Na mobilu bude hůř použitelný", kind: "DERIVED", source: "z viewportu" },
      { claim: "Vizuál působí lacině", kind: "AI_JUDGMENT", source: "dojem modelu" },
      { claim: "Majitel plánuje expanzi", kind: "UNKNOWN", source: "" },
    ],
    senderName: "Daniel Mitka",
    ...overrides,
  };
}

describe("podklady pro outreach", () => {
  /**
   * Jádro ochrany proti halucinacím (sekce 26 specky): úsudek modelu ani
   * neznámé tvrzení se do podkladů e-mailu nesmí dostat vůbec — ani jako
   * „kontext". Model nemůže citovat, co nedostal.
   */
  it("nikdy nepustí úsudek AI ani neznámé do ověřených tvrzení", () => {
    const input = buildOutreachInput(facts());

    expect(input).toContain("Web nemá viewport meta");
    expect(input).toContain("Na mobilu bude hůř použitelný");
    expect(input).not.toContain("Vizuál působí lacině");
    expect(input).not.toContain("Majitel plánuje expanzi");
  });

  it("bez použitelné evidence řekne, ať se o webu nic netvrdí", () => {
    const input = buildOutreachInput(
      facts({
        evidence: [
          { claim: "Působí zastarale", kind: "AI_JUDGMENT", source: "dojem" },
        ],
      }),
    );

    expect(input).toContain("nic o webu netvrď");
  });

  it("z problémů vybere nejvýš dva nejvážnější", () => {
    const input = buildOutreachInput(facts());

    expect(input).toContain("Chybí viewport");
    expect(input).toContain("Slabé CTA");
    expect(input).not.toContain("Drobnost");
  });

  it("nese adresáta, misi i podpis", () => {
    const input = buildOutreachInput(facts());

    expect(input).toContain("Jan Kohout");
    expect(input).toContain("Restaurace v Brně");
    expect(input).toContain("Daniel Mitka, Mitsov Web");
  });

  it("bez kontaktu řekne, ať se oslovuje obecně", () => {
    expect(buildOutreachInput(facts({ contact: null }))).toContain(
      "oslov obecně",
    );
  });
});

describe("strategie hooku", () => {
  it("přijme jen známé strategie", () => {
    expect(isOutreachStrategy("visual")).toBe(true);
    expect(isOutreachStrategy("existing")).toBe(false);
    expect(isOutreachStrategy(null)).toBe(false);
  });
});

describe("firma bez vlastního webu", () => {
  it("podklady nabízejí první web a zakazují mluvit o vylepšení", () => {
    const input = buildOutreachInput({
      companyName: "Kavárna U Lípy",
      domain: "facebook.com/kavarna-u-lipy",
      industry: "kavárna",
      location: "Praha",
      reason: "silné hodnocení, žádný web",
      mission: "kavárny bez webu",
      contact: null,
      problems: [],
      recommendation: null,
      evidence: [],
      senderName: "Mitsov Web",
    });
    expect(input).toContain("NENAŠLI");
    expect(input).toContain("postavíme jí první vlastní web");
    expect(input).toContain("nepodařilo se nám najít");
    expect(input).not.toContain("NEMÁ vlastní web");
  });

  it("firma s vlastním webem řádky o platformě nedostane", () => {
    const input = buildOutreachInput({
      companyName: "Restaurace",
      domain: "restaurace.cz",
      industry: null,
      location: null,
      reason: null,
      mission: "mise",
      contact: null,
      problems: [],
      recommendation: null,
      evidence: [],
      senderName: "Mitsov Web",
    });
    expect(input).not.toContain("NENAŠLI");
  });
});

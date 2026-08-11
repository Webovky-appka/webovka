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
    researchHooks: [],
    siteUnreachable: false,
    hasMockup: false,
    samples: [],
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
      researchHooks: [],
      siteUnreachable: false,
      hasMockup: false,
      samples: [],
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
      researchHooks: [],
      siteUnreachable: false,
      hasMockup: false,
      samples: [],
      senderName: "Mitsov Web",
    });
    expect(input).not.toContain("NENAŠLI");
  });
});

describe("koncept homepage v podkladech", () => {
  it("s mockupem podklady chtějí jednu větu o příloze a strategii visual", () => {
    const input = buildOutreachInput(facts({ hasMockup: true }));

    expect(input).toContain("přiložíme obrázek s konceptem");
    expect(input).toContain("strategii visual");
  });

  it("bez mockupu se o příloze nemluví", () => {
    expect(buildOutreachInput(facts())).not.toContain(
      "přiložíme obrázek s konceptem",
    );
  });
});

describe("háčky z company researche", () => {
  it("použitelné háčky projdou i s kategorií, dojem modelu ne", () => {
    const input = buildOutreachInput(
      facts({
        researchHooks: [
          {
            claim: "Zákazník v květnové recenzi chválí novou zahrádku",
            kind: "OBSERVED",
            source: "mapy.google.com",
            category: "recenze",
          },
          {
            claim: "Firma působí zavedeně",
            kind: "AI_JUDGMENT",
            source: "dojem modelu",
            category: "jine",
          },
        ],
      }),
    );

    expect(input).toContain("Čerstvé háčky o firmě");
    expect(input).toContain("[Recenze] Zákazník v květnové recenzi");
    expect(input).toContain("NEJVÝŠ JEDEN");
    expect(input).not.toContain("Firma působí zavedeně");
  });

  it("bez použitelných háčků se sekce vůbec neobjeví", () => {
    const onlyJudgment = buildOutreachInput(
      facts({
        researchHooks: [
          {
            claim: "Vypadá to na rodinný podnik",
            kind: "AI_JUDGMENT",
            source: "dojem",
            category: "jine",
          },
        ],
      }),
    );

    expect(onlyJudgment).not.toContain("Čerstvé háčky o firmě");
    expect(buildOutreachInput(facts())).not.toContain("Čerstvé háčky o firmě");
  });
});

describe("vzorové e-maily v podkladech", () => {
  it("vzory jdou do podkladů se zákazem brát z nich fakta", () => {
    const input = buildOutreachInput(
      facts({
        samples: [
          {
            label: "restaurace, formální",
            subject: "Dotaz k webu",
            body: "Dobrý den,\n\ntakhle to píšu já.\n\nS pozdravem\nDaniel",
            note: "vykání, konec otázkou",
          },
        ],
      }),
    );

    expect(input).toContain("restaurace, formální");
    expect(input).toContain("takhle to píšu já");
    expect(input).toContain("NIKDY z nich neber fakta");
  });

  it("bez vzorů se o nich v podkladech nemluví", () => {
    expect(buildOutreachInput(facts())).not.toContain("Vzorové e-maily");
  });
});

describe("web, který se nenačetl", () => {
  /**
   * Nedostupný web je prodejní argument, ale jen o něm se smí mluvit —
   * vzhled ani obsah nikdo neviděl, takže o nich nesmí padnout ani slovo.
   */
  it("podklady staví e-mail na nedostupnosti a zakazují hodnotit vzhled", () => {
    const input = buildOutreachInput(
      facts({ siteUnreachable: true, evidence: [], problems: [] }),
    );

    expect(input).toContain("NENAČETL SE");
    expect(input).toContain("nenačetl se mi");
    expect(input).toContain("NIKDY nehodnoť vzhled ani obsah");
    expect(input).toContain("se nám opakovaně nenačetl");
  });

  it("u načteného webu se o nedostupnosti nemluví", () => {
    expect(buildOutreachInput(facts())).not.toContain("NENAČETL SE");
  });
});

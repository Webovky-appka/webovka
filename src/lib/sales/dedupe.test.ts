import { describe, expect, it } from "vitest";

import { dedupeDecision, normalizeDomain } from "./dedupe";
import { costMicroUsd, WEB_SEARCH_FEE_MICRO_USD } from "./pricing";

describe("normalizace domény", () => {
  it("sjednotí zápisy téhož webu na jeden klíč", () => {
    for (const value of [
      "https://www.pekarna.cz",
      "http://pekarna.cz/",
      "pekarna.cz",
      "WWW.PEKARNA.CZ/menu?den=po",
    ]) {
      expect(normalizeDomain(value)).toBe("pekarna.cz");
    }
  });

  it("odmítne, co doménou firmy není", () => {
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("192.168.1.1")).toBeNull();
    expect(normalizeDomain("intranet.local")).toBeNull();
    expect(normalizeDomain("jenslovo")).toBeNull();
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
  });

  it("zachová subdomény kromě www", () => {
    expect(normalizeDomain("https://eshop.firma.cz/kosik")).toBe("eshop.firma.cz");
  });
});

describe("deduplikace a cooldown", () => {
  const now = new Date("2026-07-31T12:00:00Z");
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("novou firmu pustí dál", () => {
    expect(
      dedupeDecision({ isClient: false, existingLeads: [], now }),
    ).toEqual({ action: "create" });
  });

  it("našeho klienta nikdy neosloví", () => {
    const decision = dedupeDecision({
      isClient: true,
      existingLeads: [],
      now,
    });
    expect(decision.action).toBe("skip");
  });

  it("rozpracovaný lead blokuje nový, bez ohledu na stáří", () => {
    const decision = dedupeDecision({
      isClient: false,
      existingLeads: [{ status: "CONTACTED", updatedAt: daysAgo(400) }],
      now,
    });
    expect(decision.action).toBe("skip");
  });

  it("čerstvé zamítnutí drží cooldown", () => {
    const decision = dedupeDecision({
      isClient: false,
      existingLeads: [{ status: "REJECTED", updatedAt: daysAgo(30) }],
      now,
    });
    expect(decision.action).toBe("skip");
    expect("reason" in decision && decision.reason).toContain("cooldown");
  });

  it("po uplynutí cooldownu jde firma oslovit znovu", () => {
    expect(
      dedupeDecision({
        isClient: false,
        existingLeads: [{ status: "LOST", updatedAt: daysAgo(200) }],
        now,
      }),
    ).toEqual({ action: "create" });
  });

  it("hranice cooldownu: 179 dní blokuje, 181 pouští", () => {
    const blocked = dedupeDecision({
      isClient: false,
      existingLeads: [{ status: "REJECTED", updatedAt: daysAgo(179) }],
      now,
    });
    const allowed = dedupeDecision({
      isClient: false,
      existingLeads: [{ status: "REJECTED", updatedAt: daysAgo(181) }],
      now,
    });
    expect(blocked.action).toBe("skip");
    expect(allowed.action).toBe("create");
  });
});

describe("cena volání", () => {
  it("počítá tokeny podle ceníku modelu", () => {
    // gpt-4o-mini: 0,15 / 0,60 USD za milion tokenů.
    expect(
      costMicroUsd({ model: "gpt-4o-mini", tokensIn: 1_000_000, tokensOut: 0 }),
    ).toBe(150_000);
    expect(
      costMicroUsd({ model: "gpt-4o-mini", tokensIn: 0, tokensOut: 1_000_000 }),
    ).toBe(600_000);
  });

  it("přičítá paušál za každé vyhledávání", () => {
    expect(
      costMicroUsd({
        model: "gpt-4o",
        tokensIn: 0,
        tokensOut: 0,
        webSearchCalls: 3,
      }),
    ).toBe(3 * WEB_SEARCH_FEE_MICRO_USD);
  });

  it("neznámý model má nulovou cenu, ale nepadá", () => {
    expect(
      costMicroUsd({ model: "cosi-noveho", tokensIn: 5000, tokensOut: 5000 }),
    ).toBe(0);
  });
});

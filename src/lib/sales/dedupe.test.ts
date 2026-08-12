import { describe, expect, it } from "vitest";

import {
  dedupeDecision,
  isSharedPlatformDomain,
  isSharedPlatformUrl,
  normalizeDomain,
} from "./dedupe";
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

describe("sdílené platformní domény", () => {
  it("u facebookové stránky zachová cestu, jinak by všechny firmy splynuly", () => {
    for (const value of [
      "https://www.facebook.com/BonjourVietnamPraha",
      "https://m.facebook.com/BonjourVietnamPraha/",
      "facebook.com/bonjourvietnampraha?locale=cs_CZ",
    ]) {
      expect(normalizeDomain(value)).toBe("facebook.com/bonjourvietnampraha");
    }
  });

  it("dvě různé stránky na téže platformě dostanou různé klíče", () => {
    expect(normalizeDomain("facebook.com/prvnipodnik")).not.toBe(
      normalizeDomain("facebook.com/druhypodnik"),
    );
    expect(normalizeDomain("https://www.instagram.com/kavarna_u_lipy/")).toBe(
      "instagram.com/kavarna_u_lipy",
    );
    expect(normalizeDomain("linktr.ee/bistro.na.rohu")).toBe(
      "linktr.ee/bistro.na.rohu",
    );
  });

  it("root sdílené platformy podnik neidentifikuje a vrací null", () => {
    expect(normalizeDomain("facebook.com")).toBeNull();
    expect(normalizeDomain("https://www.facebook.com/")).toBeNull();
    expect(normalizeDomain("instagram.com")).toBeNull();
    expect(normalizeDomain("https://www.google.com")).toBeNull();
  });

  it("identitu v parametru dotazu zachová, šum zahodí", () => {
    expect(normalizeDomain("https://www.facebook.com/profile.php?id=61553012345")).toBe(
      "facebook.com/profile.php?id=61553012345",
    );
    expect(
      normalizeDomain("https://instagram.com/kavarna_u_lipy?igsh=MXc2ZnZ4"),
    ).toBe("instagram.com/kavarna_u_lipy");
  });

  it("z mapových URL vynechá souřadnice a datové bloby", () => {
    expect(
      normalizeDomain(
        "https://www.google.com/maps/place/Bonjour+Vietnam/@50.075,14.437,17z/data=!3m1!4b1",
      ),
    ).toBe("google.com/maps/place/bonjour+vietnam");
  });

  it("krátké domény typu m.me nerozbije odřezávání mobilních prefixů", () => {
    expect(normalizeDomain("m.me/nazevpodniku")).toBe("m.me/nazevpodniku");
    expect(normalizeDomain("m.facebook.com/nazevpodniku")).toBe(
      "facebook.com/nazevpodniku",
    );
  });

  it("isSharedPlatformUrl poznává platformy včetně subdomén", () => {
    expect(isSharedPlatformUrl("https://facebook.com")).toBe(true);
    expect(isSharedPlatformUrl("maps.google.com/maps")).toBe(true);
    expect(isSharedPlatformUrl("https://www.pekarna.cz")).toBe(false);
    expect(isSharedPlatformUrl("nesmysl")).toBe(false);
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

describe("doména sdílené platformy na prospektu", () => {
  it("pozná stránku podniku i s parametrem identity", () => {
    expect(isSharedPlatformDomain("facebook.com/kavarna-u-lipy")).toBe(true);
    expect(isSharedPlatformDomain("facebook.com/profile.php?id=123")).toBe(true);
    expect(isSharedPlatformDomain("instagram.com/mako_sushi")).toBe(true);
  });

  it("vlastní web ani prázdno platformou nejsou", () => {
    expect(isSharedPlatformDomain("kavarnaulipy.cz")).toBe(false);
    expect(isSharedPlatformDomain(null)).toBe(false);
    expect(isSharedPlatformDomain("")).toBe(false);
  });
});

describe("ceník novějších modelů", () => {
  /**
   * Datované a novější varianty (gpt-5.5-2026-04-23) v tabulce nejsou.
   * Nesmí spadnout na nulu — tichá nula v analytice je horší než odhad
   * podle rodiny.
   */
  it("neznámou variantu počítá podle rodiny, ne jako nulu", () => {
    const family = costMicroUsd({
      model: "gpt-5",
      tokensIn: 100_000,
      tokensOut: 10_000,
    });
    expect(
      costMicroUsd({
        model: "gpt-5.5-2026-04-23",
        tokensIn: 100_000,
        tokensOut: 10_000,
      }),
    ).toBe(family);
    expect(
      costMicroUsd({ model: "gpt-5.4-mini", tokensIn: 1_000_000, tokensOut: 0 }),
    ).toBe(
      costMicroUsd({ model: "gpt-5-mini", tokensIn: 1_000_000, tokensOut: 0 }),
    );
  });

  it("úplně cizí model zůstává nulový, ale tokeny se zapsaly", () => {
    expect(
      costMicroUsd({ model: "llama-nekde", tokensIn: 1_000_000, tokensOut: 0 }),
    ).toBe(0);
  });
});

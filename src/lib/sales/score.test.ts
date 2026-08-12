import { describe, expect, it } from "vitest";

import { opportunityScore, SCORE_FORMULA_HINT } from "./score";

describe("skóre příležitosti", () => {
  /**
   * Přání majitele studia, na kterém celý vzorec stojí: horší web musí
   * znamenat větší příležitost. Když tohle přestane platit, skóre lže.
   */
  it("horší web = větší příležitost, při stejné firmě", () => {
    const strong = { businessStrength: 80 };
    const scores = [10, 30, 50, 70, 90].map((websiteQuality) =>
      opportunityScore({ ...strong, websiteQuality }),
    );

    for (let i = 1; i < scores.length; i += 1) {
      expect(scores[i]).toBeLessThan(scores[i - 1]);
    }
  });

  it("silnější firma = větší příležitost, při stejném webu", () => {
    const site = { websiteQuality: 30 };
    expect(opportunityScore({ businessStrength: 90, ...site })).toBeGreaterThan(
      opportunityScore({ businessStrength: 50, ...site }),
    );
  });

  it("dobrý web srazí skóre hluboko i u silné firmy", () => {
    // Web, který nepřekonáme: nemá cenu firmu obtěžovat.
    expect(
      opportunityScore({ businessStrength: 90, websiteQuality: 90 }),
    ).toBeLessThan(20);
  });

  it("slabá firma s rozbitým webem nevyskočí nahoru", () => {
    // Rozbitý web sám nestačí — firma bez rozpočtu není příležitost.
    expect(
      opportunityScore({ businessStrength: 30, websiteQuality: 10 }),
    ).toBeLessThan(
      opportunityScore({ businessStrength: 80, websiteQuality: 40 }),
    );
  });

  it("typický cíl padne do pásma, kde ho práh kampaně propustí", () => {
    // Silná firma (80) se slabým webem (35) je přesně to, co hledáme.
    const score = opportunityScore({
      businessStrength: 80,
      websiteQuality: 35,
    });
    expect(score).toBeGreaterThanOrEqual(60);
    expect(score).toBeLessThanOrEqual(80);
  });

  it("firma bez webu má skóre z nejvyššího pásma", () => {
    expect(
      opportunityScore({ businessStrength: 80, websiteQuality: 10 }),
    ).toBeGreaterThan(85);
  });

  it("drží se v rozsahu 0–100 i u nesmyslných vstupů", () => {
    expect(
      opportunityScore({ businessStrength: 999, websiteQuality: -50 }),
    ).toBe(100);
    expect(opportunityScore({ businessStrength: 0, websiteQuality: 0 })).toBe(0);
    expect(
      opportunityScore({ businessStrength: Number.NaN, websiteQuality: 50 }),
    ).toBe(0);
  });

  it("vysvětlení pro UI mluví o obou vstupech", () => {
    expect(SCORE_FORMULA_HINT).toContain("síla firmy");
    expect(SCORE_FORMULA_HINT).toContain("kvalita webu");
  });
});

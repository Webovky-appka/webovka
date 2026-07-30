import { describe, expect, it } from "vitest";

import { megabytes, planUpload, SHRINKABLE_TYPES } from "./upload-plan";

const LIMIT = 4 * 1024 * 1024;

describe("rozhodnutí o vybraném souboru", () => {
  it("malý soubor pustí dál", () => {
    expect(planUpload({ type: "image/jpeg", size: 500_000 }, LIMIT)).toEqual({
      action: "upload",
    });
  });

  it("soubor přesně na limitu ještě projde", () => {
    expect(planUpload({ type: "image/png", size: LIMIT }, LIMIT)).toEqual({
      action: "upload",
    });
  });

  it("velkou fotku pošle ke zmenšení", () => {
    expect(planUpload({ type: "image/jpeg", size: 9_000_000 }, LIMIT)).toEqual({
      action: "shrink",
    });
  });

  /**
   * Animovaný GIF a SVG se nepřekódovávají — GIF by přišel o animaci a SVG je
   * kresba, kterou by rastrování zničilo. Radši se odmítnou.
   */
  it("velký GIF ani SVG nezmenšuje", () => {
    for (const type of ["image/gif", "image/svg+xml"]) {
      const plan = planUpload({ type, size: 9_000_000 }, LIMIT);
      expect(plan.action).toBe("refuse");
    }
  });

  it("velké PDF odmítne a řekne kolik a kolik smí", () => {
    const plan = planUpload({ type: "application/pdf", size: 9_000_000 }, LIMIT);

    expect(plan.action).toBe("refuse");
    expect("reason" in plan && plan.reason).toContain("8,6 MB");
    expect("reason" in plan && plan.reason).toContain("4,0 MB");
  });

  it("prázdný soubor odmítne", () => {
    expect(planUpload({ type: "image/png", size: 0 }, LIMIT).action).toBe(
      "refuse",
    );
  });

  it("zmenšovat umíme jen formáty, které jde překódovat", () => {
    expect(SHRINKABLE_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
  });
});

describe("velikost v češtině", () => {
  it("používá desetinnou čárku", () => {
    expect(megabytes(4 * 1024 * 1024)).toBe("4,0 MB");
    expect(megabytes(1_500_000)).toBe("1,4 MB");
  });
});

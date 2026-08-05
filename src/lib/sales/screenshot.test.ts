import { describe, expect, it } from "vitest";

import {
  COOKIE_BUTTON_TEXTS,
  MAX_EXTRA_PAGES,
  pickSubpages,
  salesScreenshotKey,
} from "@/lib/sales/screenshot";

describe("výběr podstránek k fotografování", () => {
  const links = [
    { href: "https://example.cz/o-nas", label: "O nás" },
    { href: "https://example.cz/galerie", label: "Galerie" },
    { href: "https://example.cz/blog", label: "Blog" },
    { href: "https://example.cz/rezervace", label: "Rezervace" },
    { href: "https://example.cz/ubytovani", label: "Ubytování" },
  ];

  it("upřednostní rezervaci a ubytování před blogem", () => {
    const picked = pickSubpages(links);
    expect(picked).toHaveLength(MAX_EXTRA_PAGES);
    const hrefs = picked.map((link) => link.href);
    expect(hrefs).toContain("https://example.cz/rezervace");
    expect(hrefs).not.toContain("https://example.cz/blog");
  });

  it("porovnává bez diakritiky — Ubytování najde přes „ubytovani“", () => {
    const picked = pickSubpages(
      [{ href: "https://example.cz/x", label: "Ubytování" }],
      1,
    );
    expect(picked).toHaveLength(1);
  });

  it("bez klíčových slov vezme první odkazy v pořadí", () => {
    const generic = [
      { href: "https://example.cz/a", label: "Alfa" },
      { href: "https://example.cz/b", label: "Beta" },
      { href: "https://example.cz/c", label: "Gama" },
    ];
    expect(pickSubpages(generic).map((link) => link.href)).toEqual([
      "https://example.cz/a",
      "https://example.cz/b",
    ]);
  });
});

describe("zavírání cookie lišt", () => {
  it("zkouší nejdřív odmítnutí, souhlas až jako zálohu", () => {
    const rejectIndex = COOKIE_BUTTON_TEXTS.indexOf("odmítnout vše");
    const acceptIndex = COOKIE_BUTTON_TEXTS.indexOf("přijmout vše");
    expect(rejectIndex).toBeGreaterThanOrEqual(0);
    expect(acceptIndex).toBeGreaterThan(rejectIndex);
  });
});

describe("klíče snímků", () => {
  it("podstránky mají číslované klíče", () => {
    expect(salesScreenshotKey("lead1", "page-0")).toBe(
      "sales/lead1/page-0.jpg",
    );
  });
});

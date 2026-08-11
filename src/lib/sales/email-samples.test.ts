import { describe, expect, it } from "vitest";

import {
  buildSampleBlock,
  MAX_SAMPLE_CHARS,
  MAX_SAMPLES,
  type EmailSample,
} from "./email-samples";

function sample(overrides: Partial<EmailSample> = {}): EmailSample {
  return {
    label: "restaurace, formální",
    subject: "Krátký dotaz k vašemu webu",
    body: "Dobrý den,\n\nvšiml jsem si vaší nové zahrádky…\n\nS pozdravem\nDaniel",
    note: "vykání, žádné superlativy, konec otázkou",
    ...overrides,
  };
}

describe("vzorové e-maily v podkladech", () => {
  it("nese popisek, poznámku, předmět i text", () => {
    const block = buildSampleBlock([sample()]).join("\n");

    expect(block).toContain("restaurace, formální");
    expect(block).toContain("vykání, žádné superlativy");
    expect(block).toContain("Krátký dotaz k vašemu webu");
    expect(block).toContain("nové zahrádky");
  });

  /**
   * Nejdůležitější hranice: vzor je o jiné firmě. Kdyby si z něj model vzal
   * fakt, tvrdí o adresátovi něco, co neplatí — proto to musí být v podkladech
   * napsané a nesmí to zmizet.
   */
  it("zakazuje brát ze vzoru fakta", () => {
    const block = buildSampleBlock([sample()]).join("\n");

    expect(block).toContain("TÓN");
    expect(block).toContain("NIKDY z nich neber fakta");
    expect(block).toContain("neopisuj");
  });

  it("bez vzorů nevrací vůbec nic", () => {
    expect(buildSampleBlock([])).toEqual([]);
  });

  it("posílá nejvýš MAX_SAMPLES vzorů", () => {
    // Popisky se nesmí trefit s číslováním bloku („--- vzor 3: …“).
    const many = Array.from({ length: MAX_SAMPLES + 2 }, (_, index) =>
      sample({ label: `ukázka-${index}` }),
    );
    const block = buildSampleBlock(many).join("\n");

    expect(block).toContain(`(${MAX_SAMPLES})`);
    expect(block).toContain("ukázka-0");
    expect(block).toContain(`ukázka-${MAX_SAMPLES - 1}`);
    expect(block).not.toContain(`ukázka-${MAX_SAMPLES}`);
  });

  it("dlouhý vzor zkrátí, ať podklady nepřerostou zadání", () => {
    const block = buildSampleBlock([
      sample({ body: "a".repeat(MAX_SAMPLE_CHARS + 500) }),
    ]).join("\n");

    expect(block).toContain("(zkráceno)");
    expect(block.length).toBeLessThan(MAX_SAMPLE_CHARS + 700);
  });

  it("chybějící předmět a poznámka nevyrobí prázdné řádky", () => {
    const block = buildSampleBlock([
      sample({ subject: null, note: null }),
    ]).join("\n");

    expect(block).not.toContain("Předmět:");
    expect(block).not.toContain("Co si na něm cenit:");
  });
});

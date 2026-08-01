import { describe, expect, it } from "vitest";

import { normalizeFoundEmail } from "./email-hygiene";

describe("hygiena nalezených adres", () => {
  it("běžnou adresu jen sjednotí na malá písmena", () => {
    expect(normalizeFoundEmail("Info@Firma.CZ")).toBe("info@firma.cz");
  });

  /**
   * Skutečný případ z ostrého běhu: web psal adresu s nedělitelnou pomlčkou
   * (U+2011) a na přepsanou adresu by nikdy nic nedošlo.
   */
  it("nahradí typografické pomlčky spojovníkem", () => {
    expect(normalizeFoundEmail("restaurace‑naruzku@email.cz")).toBe(
      "restaurace-naruzku@email.cz",
    );
    expect(normalizeFoundEmail("jan–novak@firma.cz")).toBe(
      "jan-novak@firma.cz",
    );
  });

  it("odstraní mezery z přepisu", () => {
    expect(normalizeFoundEmail(" info @ firma.cz ")).toBe("info@firma.cz");
  });

  it("zahodí, co po vyčištění není ASCII adresa", () => {
    expect(normalizeFoundEmail("info(zavináč)firma.cz")).toBeNull();
    expect(normalizeFoundEmail("žádný e-mail nenalezen")).toBeNull();
    expect(normalizeFoundEmail("info@firma")).toBeNull();
    expect(normalizeFoundEmail("")).toBeNull();
    expect(normalizeFoundEmail(null)).toBeNull();
  });
});

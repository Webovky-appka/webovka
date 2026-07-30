import { describe, expect, it } from "vitest";

import {
  buildContract,
  equalShares,
  formatCzk,
  splitPrice,
  MISSING,
  type ContractParams,
} from "./contract-template";

function params(overrides: Partial<ContractParams> = {}): ContractParams {
  return {
    supplier: {
      name: "Studio Dvou",
      ico: "12345678",
      dic: null,
      address: "Dlouhá 1, Praha, 110 00",
      bankAccount: "1234567890/0100",
      representedBy: "Daniel Mitka",
    },
    client: {
      companyName: "Pekárna U Nováků",
      contactPerson: "Jana Nováková",
      email: "jana@pekarna.cz",
      phone: "+420 601 234 567",
      ico: null,
      address: null,
    },
    projectName: "Nový web pekárny",
    totalPrice: 100_000,
    depositPercent: 30,
    hourlyRate: 900,
    revisionsPerPhase: 2,
    paymentDays: 14,
    phases: [
      { name: "Zadání", dueDate: null, share: 25 },
      { name: "Návrh", dueDate: new Date("2026-08-15T00:00:00.000Z"), share: 25 },
      { name: "Vývoj", dueDate: null, share: 25 },
      { name: "Live", dueDate: null, share: 25 },
    ],
    ...overrides,
  };
}

describe("rozpočítání ceny", () => {
  it("záloha a milníky dají dohromady přesně cenu", () => {
    const split = splitPrice(params());
    const sum =
      split.deposit + split.phases.reduce((acc, phase) => acc + phase.amount, 0);

    expect(split.deposit).toBe(30_000);
    expect(sum).toBe(100_000);
  });

  it("zaokrouhlení nesmí nechat chybějící koruny", () => {
    // 70 % ze 100 001 na tři fáze se nedělí beze zbytku.
    const split = splitPrice(
      params({
        totalPrice: 100_001,
        phases: [
          { name: "A", dueDate: null, share: 1 },
          { name: "B", dueDate: null, share: 1 },
          { name: "C", dueDate: null, share: 1 },
        ],
      }),
    );
    const sum =
      split.deposit + split.phases.reduce((acc, phase) => acc + phase.amount, 0);

    expect(sum).toBe(100_001);
  });

  it("zvládne zakázku bez fází", () => {
    const split = splitPrice(params({ phases: [] }));

    expect(split.phases).toEqual([]);
    expect(split.deposit).toBe(30_000);
  });

  it("bez zálohy rozdělí celou cenu mezi fáze", () => {
    const split = splitPrice(params({ depositPercent: 0 }));

    expect(split.deposit).toBe(0);
    expect(split.phases.reduce((acc, p) => acc + p.amount, 0)).toBe(100_000);
  });

  it("rovnoměrné podíly odpovídají počtu fází", () => {
    expect(equalShares(4)).toEqual([25, 25, 25, 25]);
    expect(equalShares(0)).toEqual([]);
  });
});

describe("částky v češtině", () => {
  it("formátuje s mezerami a korunami", () => {
    // Nezlomitelná mezera z Intl, proto porovnáváme přes regulární výraz.
    expect(formatCzk(100000)).toMatch(/^100.000 Kč$/);
  });
});

describe("text smlouvy", () => {
  const text = buildContract(params());

  it("obsahuje obě strany a předmět díla", () => {
    expect(text).toContain("Studio Dvou");
    expect(text).toContain("Pekárna U Nováků");
    expect(text).toContain("Nový web pekárny");
  });

  it("uvádí zálohu i každý milník s částkou", () => {
    expect(text).toContain("30 %");
    for (const phase of ["Zadání", "Návrh", "Vývoj", "Live"]) {
      expect(text).toContain(phase);
    }
    expect(text).toMatch(/17.500 Kč/);
  });

  it("termín fáze uvádí ve správný kalendářní den", () => {
    expect(text).toContain("15. 8. 2026");
  });

  /** Kvůli tomuhle celá šablona existuje — tyhle věty nesmí zmizet. */
  it("drží ochranná ustanovení", () => {
    expect(text).toContain("Licence přechází na objednatele až úplným zaplacením");
    expect(text).toContain("omezena do výše ceny");
    expect(text).toContain("kola úprav");
    expect(text).toContain("staví termíny");
    expect(text).toContain("porušení práv třetích osob");
    expect(text).toContain("úrok z prodlení");
  });

  it("chybějící údaje označí k doplnění, netváří se hotově", () => {
    expect(text).toContain(`IČO: ${MISSING}`);
  });

  it("u zakázky bez fází nevypíše prázdný rozpis", () => {
    const withoutPhases = buildContract(params({ phases: [] }));

    expect(withoutPhases).toContain("III. ETAPY A TERMÍNY");
    expect(withoutPhases).not.toContain("   1.");
  });

  it("odkazuje na občanský zákoník", () => {
    expect(text).toContain("89/2012");
  });
});

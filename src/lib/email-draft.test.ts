import { describe, expect, it } from "vitest";

import {
  buildContextText,
  isTone,
  splitDraft,
  systemPrompt,
  templateDraft,
  userPrompt,
  type EmailContext,
} from "./email-draft";

const SIGNATURE = "Daniel Mitka\nMitsov Web";

function context(overrides: Partial<EmailContext> = {}): EmailContext {
  return {
    companyName: "Pekárna U Nováků",
    contactPerson: "Jana Nováková",
    clientEmail: "jana@pekarna.cz",
    website: "https://pekarna.cz",
    projectName: "Nový web pekárny",
    projectStatus: "aktivní",
    currentPhaseName: "Vývoj",
    phases: [
      { name: "Zadání", completed: true, dueDate: null, openTasks: [] },
      { name: "Návrh", completed: true, dueDate: null, openTasks: [] },
      {
        name: "Vývoj",
        completed: false,
        dueDate: new Date("2026-08-15T00:00:00.000Z"),
        openTasks: ["Naprogramovat fotogalerii", "Nasadit na testovací server"],
      },
      { name: "Live", completed: false, dueDate: null, openTasks: [] },
    ],
    portalNote: "Programujeme fotogalerii.",
    previewUrl: "https://test.pekarna.cz",
    approvals: [
      { phaseName: "Návrh", createdAt: new Date("2026-07-20T10:00:00.000Z") },
    ],
    messages: [
      {
        createdAt: new Date("2026-07-25T08:00:00.000Z"),
        kind: "CALL",
        author: "Daniel",
        body: "Prošli jsme rozsah webu.",
      },
    ],
    ...overrides,
  };
}


describe("podklady pro model", () => {
  it("obsahuje klienta, fáze i nehotové úkoly aktuální fáze", () => {
    const text = buildContextText(context());

    expect(text).toContain("Pekárna U Nováků");
    expect(text).toContain("Aktuální fáze: Vývoj");
    expect(text).toContain("Zadání: hotová");
    expect(text).toContain("Naprogramovat fotogalerii");
  });

  it("termín fáze uvádí ve správný kalendářní den", () => {
    // Termíny jsou uložené jako midnight v UTC, nesmí se posunout o den.
    expect(buildContextText(context())).toContain("termín 15. 8. 2026");
  });

  it("u ukončené fáze neuvádí zbylé nehotové úkoly", () => {
    const text = buildContextText(
      context({
        phases: [
          {
            name: "Návrh",
            completed: true,
            dueDate: null,
            openTasks: ["Zapomenutý úkol"],
          },
        ],
      }),
    );

    expect(text).toContain("Návrh: hotová");
    expect(text).not.toContain("Zapomenutý úkol");
    expect(text).not.toContain("nehotový úkol");
  });

  it("bez výslovného přání neuvede interní poznámku", () => {
    const text = buildContextText(
      context({ internalNote: null }),
    );

    expect(text).not.toContain("Interní poznámka");
  });

  it("interní poznámku přidá, jen když je předaná", () => {
    const text = buildContextText(
      context({ internalNote: "Platí pozdě, hlídat splatnost." }),
    );

    expect(text).toContain("Interní poznámka: Platí pozdě");
  });
});

describe("zadání pro model", () => {
  it("nese podklady, zadání, adresáta i podpis", () => {
    const prompt = userPrompt(context(), "Poproš o schválení návrhu", SIGNATURE);

    expect(prompt).toContain("Pekárna U Nováků");
    expect(prompt).toContain("Zadání pro e-mail: Poproš o schválení návrhu");
    expect(prompt).toContain("Komu píšeš: Jana Nováková");
    expect(prompt).toContain(SIGNATURE);
  });

  /**
   * Dřív tady stálo „Oslov jménem Jana v 5. pádě, tedy Dobrý den, Jana v 5.
   * pádě,“ a model to vzal doslova — v e-mailu pak bylo „Dobrý den, Daniel v 5.
   * pádě,“. Instrukce nesmí být uvnitř textu, který má model použít.
   */
  it("nedává jméno do věty, kterou by model mohl opsat do e-mailu", () => {
    const prompt = userPrompt(context(), "Cokoli", SIGNATURE);

    expect(prompt).not.toMatch(/Jana v 5\. pádě/);
    expect(prompt).not.toMatch(/Dobrý den, Jana/);
  });

  it("bez kontaktní osoby řekne, ať se oslovuje obecně", () => {
    const prompt = userPrompt(
      context({ contactPerson: null }),
      "Cokoli",
      SIGNATURE,
    );

    expect(prompt).toContain("kontaktní osoba není známá");
  });
});

describe("pravidla pro model", () => {
  it("popíšou skloňování do 5. pádu na cizích jménech", () => {
    const rules = systemPrompt("friendly");

    // Příklady musí být na jiných jménech, než jaká chodí v podkladech,
    // jinak si model může splést příklad se jménem klienta.
    expect(rules).toContain("5. pádu");
    expect(rules).toContain("Jana → Jano");
  });

  it("mění oslovení podle tónu", () => {
    expect(systemPrompt("formal")).toContain("pane Dvořáku");
    expect(systemPrompt("friendly")).toContain("Dobrý den, Jano,");
    expect(systemPrompt("short")).toContain("bez jména");
  });

  it("zakáže vypsat instrukce do e-mailu", () => {
    expect(systemPrompt("formal")).toContain(
      "Psát do e-mailu jakoukoli instrukci",
    );
  });

  it("nechá podpis na pokoji", () => {
    expect(systemPrompt("formal")).toContain("Podpis neměň");
  });
});

describe("rozdělení odpovědi modelu", () => {
  it("oddělí předmět od těla", () => {
    const result = splitDraft(
      "Předmět: Návrh homepage ke schválení\n\nDobrý den,\n\nposíláme návrh.",
      "záložní",
    );

    expect(result.subject).toBe("Návrh homepage ke schválení");
    expect(result.body).toBe("Dobrý den,\n\nposíláme návrh.");
  });

  it("zvládne i anglické Subject", () => {
    expect(splitDraft("Subject: Ahoj\n\nText", "záložní").subject).toBe("Ahoj");
  });

  it("bez předmětu vezme celý text jako tělo", () => {
    const result = splitDraft("Dobrý den,\n\nposíláme návrh.", "záložní");

    expect(result.subject).toBe("záložní");
    expect(result.body).toBe("Dobrý den,\n\nposíláme návrh.");
  });

  it("prázdný předmět nahradí záložním", () => {
    expect(splitDraft("Předmět:\n\nText", "záložní").subject).toBe("záložní");
  });
});

describe("návrh ze šablony", () => {
  it("zmíní fázi, termín a podepíše se", () => {
    const draft = templateDraft(context(), SIGNATURE);

    expect(draft.subject).toBe("Nový web pekárny: aktuální stav");
    expect(draft.body).toContain("je ve fázi „Vývoj“");
    expect(draft.body).toContain("15. 8. 2026");
    expect(draft.body).toContain(SIGNATURE);
  });

  it("osloví bez jména, aby nevznikl špatný pád", () => {
    const draft = templateDraft(context(), SIGNATURE);

    expect(draft.body.startsWith("Dobrý den,\n")).toBe(true);
    expect(draft.body).not.toContain("Jana");
  });

  it("neuvede odkaz na nový web, když žádný není", () => {
    const draft = templateDraft(context({ previewUrl: null }), SIGNATURE);

    expect(draft.body).not.toContain("prohlédnout");
  });

  it("nikdy nepustí do textu interní poznámku", () => {
    const draft = templateDraft(
      context({ internalNote: "Platí pozdě, hlídat splatnost." }),
      SIGNATURE,
    );

    expect(draft.body).not.toContain("Platí pozdě");
  });

  it("zvládne klienta bez kontaktní osoby", () => {
    const draft = templateDraft(context({ contactPerson: null }), SIGNATURE);

    expect(draft.body.startsWith("Dobrý den,")).toBe(true);
  });
});

describe("volba tónu", () => {
  it("přijme jen známé hodnoty", () => {
    expect(isTone("formal")).toBe(true);
    expect(isTone("friendly")).toBe(true);
    expect(isTone("vlastni")).toBe(false);
    expect(isTone(undefined)).toBe(false);
  });
});

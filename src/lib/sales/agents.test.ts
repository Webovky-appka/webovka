import { describe, expect, it } from "vitest";

import {
  AGENT_INFO,
  DEFAULT_PROMPTS,
  SALES_AGENTS,
  isSalesAgent,
} from "./agents";

describe("registr agentů", () => {
  it("každý agent má popis i výchozí prompt", () => {
    for (const agent of SALES_AGENTS) {
      expect(AGENT_INFO[agent].name.length).toBeGreaterThan(0);
      expect(AGENT_INFO[agent].role.length).toBeGreaterThan(10);
      expect(DEFAULT_PROMPTS[agent].length).toBeGreaterThan(200);
    }
  });

  it("pozná neznámého agenta", () => {
    expect(isSalesAgent("scout")).toBe(true);
    expect(isSalesAgent("designer")).toBe(true);
    expect(isSalesAgent("coach")).toBe(false);
    expect(isSalesAgent(undefined)).toBe(false);
  });
});

/**
 * Ochranná pravidla z specifikace, která z promptů nesmí zmizet. Kdyby je
 * někdo při úpravě výchozích promptů vypustil, tenhle test to zastaví —
 * v UI si uživatel může uložit co chce, ale výchozí stav musí být bezpečný.
 */
describe("ochranná pravidla v promptech", () => {
  it("scout dává přednost kvalitě před počtem a vyžaduje evidenci", () => {
    expect(DEFAULT_PROMPTS.scout).toContain("NENÍ maximalizovat počet");
    expect(DEFAULT_PROMPTS.scout).toMatch(/evidenc/i);
  });

  it("contact nikdy nehádá e-mail a vyžaduje zdroj", () => {
    expect(DEFAULT_PROMPTS.contact).toContain("NIKDY neodhaduj");
    expect(DEFAULT_PROMPTS.contact).toContain("zdroj");
  });

  it("outreach má zákaz vymýšlení, limit délky a jediný podpis", () => {
    expect(DEFAULT_PROMPTS.outreach).toContain("Nevymýšlej si fakta");
    expect(DEFAULT_PROMPTS.outreach).toContain("120 až 170 slov");
    expect(DEFAULT_PROMPTS.outreach).toContain("právě jednou a na konci");
    // Věta o odmítnutí je na přání uživatele pryč a nesmí se vrátit.
    expect(DEFAULT_PROMPTS.outreach).not.toContain("už se neozveme");
    expect(DEFAULT_PROMPTS.outreach).toContain(
      "Žádná věta o možnosti odmítnutí",
    );
  });

  /**
   * Předloha e-mailu podle majitele studia: první osoba, nabídka ukázek
   * (ne schůzky) a otázka na konec. Kdyby to z promptu vypadlo, e-maily se
   * vrátí k obecné agenturní šabloně.
   */
  it("outreach drží předlohu majitele studia", () => {
    expect(DEFAULT_PROMPTS.outreach).toContain("jsem narazil");
    expect(DEFAULT_PROMPTS.outreach).toContain("Podíval jsem se také na Váš web");
    expect(DEFAULT_PROMPTS.outreach).toContain("nezávazně pošlu několik ukázek");
    expect(DEFAULT_PROMPTS.outreach).toContain("Měli byste zájem");
    expect(DEFAULT_PROMPTS.outreach).toContain("ne schůzku ani telefonát");
    expect(DEFAULT_PROMPTS.outreach).toContain("Žádné odrážky");
  });

  it("auditor odděluje pozorování od úsudku a netvrdí bez důkazu", () => {
    expect(DEFAULT_PROMPTS.auditor).toContain("pozorování od úsudku");
    expect(DEFAULT_PROMPTS.auditor).toContain("Netvrď, že něco chybí");
    expect(DEFAULT_PROMPTS.auditor).toContain("Dobrý web poznej");
  });

  it("research nevymýšlí, vyžaduje zdroj a hledá čerstvé", () => {
    expect(DEFAULT_PROMPTS.research).toContain("Nic si nedomýšlej");
    expect(DEFAULT_PROMPTS.research).toContain("Bez zdroje háček neukládej");
    expect(DEFAULT_PROMPTS.research).toContain("ČERSTVÉ");
  });

  it("designer zakazuje externí zdroje a vymyšlená fakta", () => {
    expect(DEFAULT_PROMPTS.designer).toContain("ŽÁDNÉ externí zdroje");
    expect(DEFAULT_PROMPTS.designer).toContain("NEVYMÝŠLEJ");
    expect(DEFAULT_PROMPTS.designer).toContain("1440×900");
  });
});

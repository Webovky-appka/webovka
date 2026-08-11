import { describe, expect, it } from "vitest";

import {
  canRescan,
  canUndoSend,
  computeFunnel,
  LOST_REASONS,
} from "./funnel";

describe("trychtýř", () => {
  it("stav leadu se počítá do všech fází, kterými prošel", () => {
    const funnel = computeFunnel({ WON: 1 });
    for (const stage of funnel.stages) {
      expect(stage.reached).toBe(1);
    }
  });

  it("kumuluje napříč stavy", () => {
    const funnel = computeFunnel({
      DISCOVERED: 2,
      QUALIFIED: 3,
      READY_FOR_REVIEW: 2,
      CONTACTED: 1,
      REPLIED: 1,
      WON: 1,
    });
    const reached = Object.fromEntries(
      funnel.stages.map((stage) => [stage.key, stage.reached]),
    );

    expect(reached.DISCOVERED).toBe(10);
    expect(reached.QUALIFIED).toBe(8);
    expect(reached.CONTACTED).toBe(3);
    expect(reached.REPLIED).toBe(2);
    expect(reached.WON).toBe(1);
  });

  /** Prohraný lead byl osloven — do reply rate ale nepatří, nevíme, kam došel. */
  it("LOST se počítá do oslovených, REJECTED jen do objevených", () => {
    const funnel = computeFunnel({ LOST: 2, REJECTED: 3 });
    const reached = Object.fromEntries(
      funnel.stages.map((stage) => [stage.key, stage.reached]),
    );

    expect(reached.DISCOVERED).toBe(5);
    expect(reached.QUALIFIED).toBe(2);
    expect(reached.CONTACTED).toBe(2);
    expect(reached.REPLIED).toBe(0);
  });

  it("poměry: reply z oslovených, meeting z odpovědí, close z oslovených", () => {
    const funnel = computeFunnel({
      CONTACTED: 2,
      REPLIED: 1,
      MEETING: 1,
      WON: 1,
    });

    // Osloveno 5, odpověděli 3, schůzky 2, výhra 1.
    expect(funnel.replyRate).toBe(60);
    expect(funnel.meetingRate).toBe(67);
    expect(funnel.closeRate).toBe(20);
  });

  it("bez oslovených jsou poměry null, ne dělení nulou", () => {
    const funnel = computeFunnel({ QUALIFIED: 5 });

    expect(funnel.replyRate).toBeNull();
    expect(funnel.closeRate).toBeNull();
  });

  it("důvody prohry odpovídají sekci 29 specifikace", () => {
    expect(LOST_REASONS).toContain("Příliš drahé");
    expect(LOST_REASONS).toContain("Už mají agenturu");
    expect(LOST_REASONS).toContain("Špatné načasování");
    expect(LOST_REASONS.length).toBeGreaterThanOrEqual(6);
  });
});

describe("kompletní proskenování", () => {
  /**
   * Zamítnutá i objevená příležitost se proskenovat musí — jinak zůstane
   * trčet ve stavu, ve kterém ji žádný běh nikdy nevezme.
   */
  it("jde ve všech stavech před oslovením včetně zamítnuté", () => {
    for (const status of [
      "DISCOVERED",
      "QUALIFYING",
      "QUALIFIED",
      "RESEARCHING",
      "READY_FOR_REVIEW",
      "APPROVED",
      "REJECTED",
    ]) {
      expect(canRescan(status)).toBe(true);
    }
  });

  /** Po oslovení by rescan přepsal historii toho, co jsme skutečně poslali. */
  it("po oslovení už ne", () => {
    for (const status of [
      "CONTACTED",
      "REPLIED",
      "MEETING",
      "PROPOSAL",
      "WON",
      "LOST",
    ]) {
      expect(canRescan(status)).toBe(false);
    }
  });
});

describe("odvolání odeslání", () => {
  it("jde jen z čerstvě oslovené", () => {
    expect(canUndoSend("CONTACTED")).toBe(true);
  });

  it("z posunutých stavů ne — nejdřív se vrací výsledek", () => {
    for (const status of ["REPLIED", "MEETING", "PROPOSAL", "WON", "LOST"]) {
      expect(canUndoSend(status)).toBe(false);
    }
    expect(canUndoSend("READY_FOR_REVIEW")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  leadPhase,
  PHASE_HEADING_CLASS,
  statusLabelClass,
} from "./status-style";

describe("fáze příležitosti podle stavu", () => {
  it("před oslovením je všechno v přípravě", () => {
    for (const status of [
      "DISCOVERED",
      "QUALIFYING",
      "QUALIFIED",
      "RESEARCHING",
      "READY_FOR_REVIEW",
      "APPROVED",
    ]) {
      expect(leadPhase(status)).toBe("prep");
    }
  });

  it("po oslovení se jedná, výhra a prohra jsou samostatné", () => {
    for (const status of ["CONTACTED", "REPLIED", "MEETING", "PROPOSAL"]) {
      expect(leadPhase(status)).toBe("talking");
    }
    expect(leadPhase("WON")).toBe("won");
    expect(leadPhase("LOST")).toBe("lost");
    // Zamítnutí je taky konec, patří k prohře.
    expect(leadPhase("REJECTED")).toBe("lost");
  });

  it("neznámý stav nespadne, bere se jako příprava", () => {
    expect(leadPhase("NECO_NOVEHO")).toBe("prep");
    expect(statusLabelClass("NECO_NOVEHO")).toContain("slate");
  });
});

describe("barvy", () => {
  it("výhra je zelená, prohra červená, jednání žluté", () => {
    expect(PHASE_HEADING_CLASS.won).toContain("emerald");
    expect(PHASE_HEADING_CLASS.lost).toContain("red");
    expect(PHASE_HEADING_CLASS.talking).toContain("amber");
    expect(statusLabelClass("WON")).toContain("emerald");
    expect(statusLabelClass("LOST")).toContain("red");
    expect(statusLabelClass("MEETING")).toContain("amber");
  });
});

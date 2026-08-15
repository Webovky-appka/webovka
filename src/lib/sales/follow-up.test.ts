import { describe, expect, it } from "vitest";

import {
  daysSince,
  FOLLOW_UP_AFTER_DAYS,
  followUpNote,
  needsFollowUp,
} from "./follow-up";

const NOW = new Date("2026-08-13T10:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000);

describe("připomínka druhého oslovení", () => {
  it("hlásí se po měsíci ticha", () => {
    expect(
      needsFollowUp({
        status: "CONTACTED",
        sentAt: daysAgo(FOLLOW_UP_AFTER_DAYS),
        now: NOW,
      }),
    ).toBe(true);
    expect(
      needsFollowUp({ status: "CONTACTED", sentAt: daysAgo(45), now: NOW }),
    ).toBe(true);
  });

  it("dřív mlčí", () => {
    expect(
      needsFollowUp({ status: "CONTACTED", sentAt: daysAgo(29), now: NOW }),
    ).toBe(false);
    expect(
      needsFollowUp({ status: "CONTACTED", sentAt: daysAgo(0), now: NOW }),
    ).toBe(false);
  });

  /**
   * Jakmile jednání běží, upomínka je otravná — a u uzavřené příležitosti
   * nesmyslná. Tohle je hlavní pojistka proti otravování zákazníků.
   */
  it("mlčí, jakmile firma zareagovala nebo je po všem", () => {
    for (const status of [
      "REPLIED",
      "MEETING",
      "PROPOSAL",
      "WON",
      "LOST",
      "REJECTED",
      "READY_FOR_REVIEW",
      "SCHEDULED",
    ]) {
      expect(needsFollowUp({ status, sentAt: daysAgo(90), now: NOW })).toBe(
        false,
      );
    }
  });

  it("bez data odeslání nemá z čeho počítat", () => {
    expect(
      needsFollowUp({ status: "CONTACTED", sentAt: null, now: NOW }),
    ).toBe(false);
    expect(
      needsFollowUp({ status: "CONTACTED", sentAt: undefined, now: NOW }),
    ).toBe(false);
  });

  it("hranici jde posunout, kdyby měsíc byl málo", () => {
    expect(
      needsFollowUp({
        status: "CONTACTED",
        sentAt: daysAgo(35),
        now: NOW,
        afterDays: 60,
      }),
    ).toBe(false);
  });

  it("počítá dny a napíše je do věty", () => {
    expect(daysSince(daysAgo(34), NOW)).toBe(34);
    expect(followUpNote(daysAgo(34), NOW)).toContain("34");
    expect(followUpNote(daysAgo(34), NOW)).toContain("bez výčitek");
  });
});

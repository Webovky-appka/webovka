import { describe, expect, it } from "vitest";

import { isContactStale, pluralCs, unfinishedTasksPhrase } from "./format";

describe("skloňování podle počtu", () => {
  it("používá jednotné číslo pro jednu položku", () => {
    expect(pluralCs(1, "zakázka", "zakázky", "zakázek")).toBe("zakázka");
  });

  it("používá druhý tvar pro dvě až čtyři", () => {
    for (const count of [2, 3, 4]) {
      expect(pluralCs(count, "zakázka", "zakázky", "zakázek")).toBe("zakázky");
    }
  });

  it("používá třetí tvar pro pět a více i pro nulu", () => {
    for (const count of [0, 5, 11, 100]) {
      expect(pluralCs(count, "zakázka", "zakázky", "zakázek")).toBe("zakázek");
    }
  });
});

describe("věta o nehotových úkolech", () => {
  it("shoduje přísudek s počtem", () => {
    expect(unfinishedTasksPhrase(1)).toBe("zbývá 1 nehotový úkol");
    expect(unfinishedTasksPhrase(3)).toBe("zbývají 3 nehotové úkoly");
    expect(unfinishedTasksPhrase(7)).toBe("zbývá 7 nehotových úkolů");
  });
});

describe("dlouho bez kontaktu", () => {
  const day = 86_400_000;

  it("nehlásí nic, když kontakt chybí", () => {
    expect(isContactStale(null)).toBe(false);
    expect(isContactStale(undefined)).toBe(false);
  });

  it("nehlásí čerstvý kontakt", () => {
    expect(isContactStale(new Date(Date.now() - 3 * day))).toBe(false);
  });

  it("hlásí kontakt starší než dva týdny", () => {
    expect(isContactStale(new Date(Date.now() - 20 * day))).toBe(true);
  });

  it("respektuje vlastní hranici ve dnech", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * day);
    expect(isContactStale(tenDaysAgo, 30)).toBe(false);
    expect(isContactStale(tenDaysAgo, 7)).toBe(true);
  });
});

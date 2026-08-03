import { describe, expect, it } from "vitest";

import {
  businessDayKey,
  formatDay,
  formatDayShort,
  isContactStale,
  isDueTodayOrOverdue,
  isOverdue,
  pluralCs,
  unfinishedTasksPhrase,
} from "./format";

/**
 * Datum z formuláře typu "2026-07-26" JavaScript parsuje na midnight v UTC.
 * Tyhle testy hlídají, že se takový den nikde neposune o jeden zpět nebo
 * dopředu podle zóny, ve které běží server.
 */
function dayFromInput(value: string): Date {
  return new Date(value);
}

/** Dnešní den českého kalendáře jako midnight v UTC, spočítaný nezávisle. */
function czechTodayAsUtcMidnight(): Date {
  const czechToday = new Date().toLocaleDateString("en-CA", {
    timeZone: "Europe/Prague",
  });
  return new Date(`${czechToday}T00:00:00.000Z`);
}

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

describe("zobrazení kalendářního dne", () => {
  it("zobrazí den, který uživatel zadal, nezávisle na zóně serveru", () => {
    expect(formatDay(dayFromInput("2026-07-26"))).toBe("26. 7. 2026");
    expect(formatDayShort(dayFromInput("2026-07-26"))).toBe("26. 7.");
  });

  it("nepřeteče na jiný měsíc u prvního a posledního dne", () => {
    expect(formatDay(dayFromInput("2026-01-01"))).toBe("1. 1. 2026");
    expect(formatDay(dayFromInput("2026-12-31"))).toBe("31. 12. 2026");
  });

  it("bez data vrací pomlčku", () => {
    expect(formatDay(null)).toBe("—");
    expect(formatDayShort(undefined)).toBe("—");
  });
});

describe("termín po datu", () => {
  const day = 86_400_000;

  it("bez termínu nic nehlásí", () => {
    expect(isOverdue(null)).toBe(false);
    expect(isOverdue(undefined)).toBe(false);
  });

  it("dnešní termín není po termínu", () => {
    expect(isOverdue(czechTodayAsUtcMidnight())).toBe(false);
  });

  it("zítřejší termín není po termínu", () => {
    const tomorrow = new Date(czechTodayAsUtcMidnight().getTime() + day);
    expect(isOverdue(tomorrow)).toBe(false);
  });

  it("včerejší termín je po termínu", () => {
    const yesterday = new Date(czechTodayAsUtcMidnight().getTime() - day);
    expect(isOverdue(yesterday)).toBe(true);
  });

  it("dávná i vzdálená data vyhodnotí správně", () => {
    expect(isOverdue(dayFromInput("2020-01-01"))).toBe(true);
    expect(isOverdue(dayFromInput("2099-01-01"))).toBe(false);
  });
});

describe("dnešní seznam práce", () => {
  const day = 86_400_000;

  it("dnešní i prošlý termín na něj patří, zítřejší ne", () => {
    const today = czechTodayAsUtcMidnight();
    expect(isDueTodayOrOverdue(today)).toBe(true);
    expect(isDueTodayOrOverdue(new Date(today.getTime() - day))).toBe(true);
    expect(isDueTodayOrOverdue(new Date(today.getTime() + day))).toBe(false);
    expect(isDueTodayOrOverdue(null)).toBe(false);
  });
});

describe("klíč dne pro denní stavy", () => {
  it("odpovídá českému kalendáři ve tvaru YYYY-MM-DD", () => {
    const expected = new Date().toLocaleDateString("en-CA", {
      timeZone: "Europe/Prague",
    });
    expect(businessDayKey()).toBe(expected);
    expect(businessDayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

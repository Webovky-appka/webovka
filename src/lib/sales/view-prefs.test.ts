import { describe, expect, it } from "vitest";

import {
  isPrefOn,
  SHOW_ARCHIVED_COOKIE,
  SHOW_REJECTED_COOKIE,
  VIEW_PREF_MAX_AGE,
} from "./view-prefs";

describe("uložené zobrazení sekcí", () => {
  it("zapnuto je jen explicitní „1“", () => {
    expect(isPrefOn("1")).toBe(true);
    expect(isPrefOn("0")).toBe(false);
    expect(isPrefOn("")).toBe(false);
    expect(isPrefOn("true")).toBe(false);
    expect(isPrefOn(undefined)).toBe(false);
  });

  it("každá sekce má vlastní cookie a pamatuje si to dlouho", () => {
    expect(SHOW_REJECTED_COOKIE).not.toBe(SHOW_ARCHIVED_COOKIE);
    expect(VIEW_PREF_MAX_AGE).toBeGreaterThan(60 * 60 * 24 * 30);
  });
});

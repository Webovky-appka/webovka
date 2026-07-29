import { describe, expect, it } from "vitest";

import {
  commitSummary,
  parseRepo,
  repoUrl,
  runLabel,
  runTone,
  type RepoRun,
} from "@/lib/github";

function run(overrides: Partial<RepoRun> = {}): RepoRun {
  return {
    name: "CI",
    status: "completed",
    conclusion: "success",
    branch: "main",
    createdAt: null,
    url: "https://github.com/owner/repo/actions/runs/1",
    ...overrides,
  };
}

describe("parseRepo", () => {
  it("vezme owner/repo zapsané přímo", () => {
    expect(parseRepo("Webovky-appka/web-appka")).toBe(
      "Webovky-appka/web-appka",
    );
  });

  it("vytáhne repozitář z adresy webu", () => {
    expect(parseRepo("https://github.com/owner/repo")).toBe("owner/repo");
    expect(parseRepo("http://www.github.com/owner/repo/")).toBe("owner/repo");
    expect(parseRepo("github.com/owner/repo")).toBe("owner/repo");
  });

  it("zvládne ssh remote i koncovku .git", () => {
    expect(parseRepo("git@github.com:owner/repo.git")).toBe("owner/repo");
    expect(parseRepo("https://github.com/owner/repo.git")).toBe("owner/repo");
  });

  it("zahodí cestu za názvem repozitáře", () => {
    expect(parseRepo("https://github.com/owner/repo/tree/main/src")).toBe(
      "owner/repo",
    );
  });

  it("odmítne, co na repozitář nevypadá", () => {
    expect(parseRepo("")).toBeNull();
    expect(parseRepo("   ")).toBeNull();
    expect(parseRepo("owner")).toBeNull();
    expect(parseRepo("https://gitlab.com/owner/repo")).toBeNull();
    expect(parseRepo("owner/repo?query=1")).toBeNull();
  });

  it("skládá adresu repozitáře", () => {
    expect(repoUrl("owner/repo")).toBe("https://github.com/owner/repo");
  });
});

describe("commitSummary", () => {
  it("vezme jen první řádek", () => {
    expect(commitSummary("Opraví termín fáze\n\nDelší popis")).toBe(
      "Opraví termín fáze",
    );
  });

  it("zvládne prázdnou zprávu", () => {
    expect(commitSummary("")).toBe("");
  });
});

describe("runLabel a runTone", () => {
  it("popíše dokončený běh česky", () => {
    expect(runLabel(run())).toBe("prošlo");
    expect(runLabel(run({ conclusion: "failure" }))).toBe("selhalo");
    expect(runTone(run())).toBe("ok");
    expect(runTone(run({ conclusion: "failure" }))).toBe("error");
  });

  it("u neskončeného běhu hlásí stav, ne výsledek", () => {
    expect(runLabel(run({ status: "in_progress", conclusion: null }))).toBe(
      "běží",
    );
    expect(runLabel(run({ status: "queued", conclusion: null }))).toBe(
      "ve frontě",
    );
    expect(runTone(run({ status: "in_progress", conclusion: null }))).toBe(
      "neutral",
    );
  });

  it("neznámý výsledek vrátí, jak přišel", () => {
    expect(runLabel(run({ conclusion: "stale" }))).toBe("stale");
    expect(runTone(run({ conclusion: "stale" }))).toBe("neutral");
  });
});

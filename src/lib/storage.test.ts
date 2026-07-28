import { describe, expect, it } from "vitest";

import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, buildStorageKey } from "./storage";

describe("klíč v úložišti", () => {
  it("začíná id klienta, aby šly soubory klienta najít pohromadě", () => {
    expect(buildStorageKey("client-1", "logo.png")).toMatch(/^client-1\//);
  });

  it("nepoužije jméno souboru od uživatele", () => {
    const key = buildStorageKey("client-1", "smlouva.pdf");
    expect(key).not.toContain("smlouva");
  });

  it("zachová příponu, aby se soubor otevřel správnou aplikací", () => {
    expect(buildStorageKey("client-1", "logo.PNG")).toMatch(/\.png$/);
    expect(buildStorageKey("client-1", "smlouva.pdf")).toMatch(/\.pdf$/);
  });

  it("neumožní vystoupit z adresáře klienta pomocí cesty ve jménu", () => {
    const attempts = [
      "../../../etc/passwd",
      "..%2f..%2fetc%2fpasswd",
      "/etc/passwd",
      "slozka/vnoreny.png",
      "....//....//tajne.txt",
    ];

    for (const filename of attempts) {
      const key = buildStorageKey("client-1", filename);
      // Za id klienta smí být právě jeden segment, žádné další lomítko ani "..".
      expect(key.split("/")).toHaveLength(2);
      expect(key).not.toContain("..");
    }
  });

  it("zvládne jméno bez přípony i s tečkou na konci", () => {
    expect(buildStorageKey("client-1", "bezpripony").split("/")).toHaveLength(2);
    expect(buildStorageKey("client-1", "tecka.").split("/")).toHaveLength(2);
  });

  it("dá dvěma souborům se stejným jménem různý klíč", () => {
    expect(buildStorageKey("client-1", "logo.png")).not.toBe(
      buildStorageKey("client-1", "logo.png"),
    );
  });
});

describe("limity nahrávání", () => {
  it("nepovoluje spustitelné ani skriptovatelné typy", () => {
    const forbidden = [
      "text/html",
      "application/javascript",
      "text/javascript",
      "image/svg+xml; charset=utf-8",
      "application/x-httpd-php",
    ];

    for (const mime of forbidden) {
      expect(ALLOWED_MIME_TYPES).not.toContain(mime);
    }
  });

  it("má limit velikosti 25 MB", () => {
    expect(MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
  });
});

import { beforeAll, describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./secrets";

const TOKEN = "1//04refresh-token-od-googlu_abcDEF";

beforeAll(() => {
  process.env.SESSION_SECRET = "testovaci-tajny-klic-pro-vitest-0123456789";
});

describe("šifrování uložených tokenů", () => {
  it("rozšifruje, co zašifrovalo", () => {
    expect(decryptSecret(encryptSecret(TOKEN))).toBe(TOKEN);
  });

  it("stejný token zašifruje pokaždé jinak", () => {
    // Náhodné IV — jinak by bylo v databázi vidět, že dva účty mají stejný token.
    expect(encryptSecret(TOKEN)).not.toBe(encryptSecret(TOKEN));
  });

  /**
   * Přepíše jeden bajt. Záměna znaku v base64url nestačí — poslední znak nese
   * jen část bajtu, takže by se dekódovaná data nemusela vůbec změnit.
   */
  function flipByte(base64url: string): string {
    const bytes = Buffer.from(base64url, "base64url");
    bytes[0] = bytes[0]! ^ 0xff;
    return bytes.toString("base64url");
  }

  it("pozná pozměněnou šifru a nevrátí nic", () => {
    const [iv, tag, payload] = encryptSecret(TOKEN).split(".");

    expect(decryptSecret(`${iv}.${tag}.${flipByte(payload!)}`)).toBeNull();
  });

  it("pozná pozměněný ověřovací kód", () => {
    const [iv, tag, payload] = encryptSecret(TOKEN).split(".");

    expect(decryptSecret(`${iv}.${flipByte(tag!)}.${payload}`)).toBeNull();
  });

  it("pozná pozměněné IV", () => {
    const [iv, tag, payload] = encryptSecret(TOKEN).split(".");

    expect(decryptSecret(`${flipByte(iv!)}.${tag}.${payload}`)).toBeNull();
  });

  it("nerozšifruje záznam zašifrovaný jiným SESSION_SECRET", () => {
    const encrypted = encryptSecret(TOKEN);

    process.env.SESSION_SECRET = "jiny-tajny-klic-0123456789-abcdefghij";
    const result = decryptSecret(encrypted);
    process.env.SESSION_SECRET = "testovaci-tajny-klic-pro-vitest-0123456789";

    expect(result).toBeNull();
  });

  it("odmítne nesmyslný vstup", () => {
    expect(decryptSecret("tohle-neni-sifra")).toBeNull();
    expect(decryptSecret("")).toBeNull();
  });

  it("bez SESSION_SECRET nešifruje vůbec", () => {
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;

    expect(() => encryptSecret(TOKEN)).toThrow(/SESSION_SECRET/);
    process.env.SESSION_SECRET = original;
  });
});

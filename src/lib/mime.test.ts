import { describe, expect, it } from "vitest";

import {
  buildRawMessage,
  encodeHeader,
  formatAddress,
  toBase64Url,
} from "./mime";

/** Rozkóduje hlavičku zapsanou podle RFC 2047 zpět na text. */
function decodeHeader(value: string): string {
  return value
    .split(/\r\n /)
    .map((word) => {
      const match = /^=\?UTF-8\?B\?(.*)\?=$/.exec(word);
      return match
        ? Buffer.from(match[1]!, "base64").toString("utf8")
        : word;
    })
    .join("");
}

describe("kódování hlaviček", () => {
  it("nechá čisté ASCII bez úprav", () => {
    expect(encodeHeader("Website update")).toBe("Website update");
  });

  it("zakóduje češtinu a jde rozkódovat zpět", () => {
    const subject = "Nový web pekárny: schválení návrhu";
    const encoded = encodeHeader(subject);

    expect(encoded).not.toContain("á");
    expect(decodeHeader(encoded)).toBe(subject);
  });

  it("nerozdělí vícebajtový znak mezi dva úseky", () => {
    const subject = "Žluťoučký kůň úpěl ďábelské ódy a příšerně se šklebil";
    const encoded = encodeHeader(subject);

    // Každé zakódované slovo musí být samo o sobě platné UTF-8.
    expect(decodeHeader(encoded)).toBe(subject);
    for (const word of encoded.split(/\r\n /)) {
      expect(word.length).toBeLessThanOrEqual(75);
    }
  });

  it("nepustí do hlavičky zalomení řádku", () => {
    const encoded = encodeHeader("Predmet\r\nBcc: cizi@example.com");

    expect(encoded).not.toContain("\r");
    expect(encoded).not.toContain("\n");
  });
});

describe("adresa odesílatele", () => {
  it("vrátí samotnou adresu, když není jméno", () => {
    expect(formatAddress("jan@example.com")).toBe("jan@example.com");
  });

  it("zakóduje jméno s diakritikou a adresu nechá čitelnou", () => {
    const value = formatAddress("jan@example.com", "Jan Dvořák");

    expect(value).toContain("<jan@example.com>");
    expect(decodeHeader(value.replace(" <jan@example.com>", ""))).toBe(
      "Jan Dvořák",
    );
  });
});

describe("skládání zprávy pro Gmail", () => {
  const message = buildRawMessage({
    to: "klient@example.com",
    from: "studio@example.com",
    fromName: "Daniel",
    subject: "Zakázka pokračuje",
    body: "Dobrý den,\n\nnávrh je hotový.\n\nS pozdravem",
  });

  it("má hlavičky oddělené prázdným řádkem", () => {
    const [headers, body] = message.split("\r\n\r\n");

    expect(headers).toContain("To: klient@example.com");
    expect(headers).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(body).not.toBe("");
  });

  it("tělo je base64 a po rozkódování odpovídá zadání", () => {
    const body = message.split("\r\n\r\n")[1]!;
    const decoded = Buffer.from(body.replace(/\r\n/g, ""), "base64").toString(
      "utf8",
    );

    expect(decoded).toBe(
      "Dobrý den,\r\n\r\nnávrh je hotový.\r\n\r\nS pozdravem",
    );
  });

  it("žádný řádek base64 nepřekročí 76 znaků", () => {
    const long = buildRawMessage({
      to: "klient@example.com",
      from: "studio@example.com",
      fromName: null,
      subject: "Dlouhý",
      body: "Řádek s diakritikou. ".repeat(80),
    });

    for (const line of long.split("\r\n\r\n")[1]!.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });

  it("nedovolí propašovat hlavičku přes adresu příjemce", () => {
    const forged = buildRawMessage({
      to: "klient@example.com\r\nBcc: cizi@example.com",
      from: "studio@example.com",
      fromName: null,
      subject: "Test",
      body: "text",
    });

    // Zalomení se nahradí mezerou, takže z Bcc zůstane jen text uvnitř hlavičky
    // To — samostatná hlavička Bcc nevznikne a nikomu skrytě nic neodejde.
    const headers = forged.split("\r\n\r\n")[0]!.split("\r\n");

    expect(headers.some((line) => /^Bcc:/i.test(line))).toBe(false);
    expect(headers.filter((line) => /^To:/i.test(line))).toHaveLength(1);
  });
});

describe("base64url pro Gmail API", () => {
  it("nepoužívá znaky, které by se v URL musely kódovat", () => {
    const encoded = toBase64Url("Příliš žluťoučký kůň ????>>>");

    expect(encoded).not.toMatch(/[+/=]/);
    expect(Buffer.from(encoded, "base64url").toString("utf8")).toContain("kůň");
  });
});

import { describe, expect, it } from "vitest";

import { contractFileName, contractToDocx } from "./contract-docx";
import { buildContract, type ContractParams } from "./contract-template";

const CONTRACT: ContractParams = {
  supplier: {
    name: "Studio Dvou",
    ico: "12345678",
    dic: null,
    address: "Dlouhá 1, Praha",
    bankAccount: "1234567890/0100",
    representedBy: "Daniel Mitka",
  },
  client: {
    companyName: "Pekárna U Nováků",
    contactPerson: "Jana Nováková",
    email: "jana@pekarna.cz",
    phone: null,
    ico: null,
    address: null,
  },
  projectName: "Nový web pekárny",
  totalPrice: 120_000,
  depositPercent: 30,
  hourlyRate: 900,
  revisionsPerPhase: 2,
  paymentDays: 14,
  phases: [
    { name: "Zadání", dueDate: null, share: 50 },
    { name: "Live", dueDate: new Date("2026-09-01T00:00:00.000Z"), share: 50 },
  ],
};

describe("export do Wordu", () => {
  it("z celé šablony vyrobí platný soubor .docx", async () => {
    const file = await contractToDocx({
      text: buildContract(CONTRACT),
      title: "Smlouva o dílo",
    });

    // .docx je zip, ten vždycky začíná PK.
    expect(file.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(file.length).toBeGreaterThan(3000);
    // Jména souborů jsou v zipu nekomprimovaná, takže je jde najít v bajtech.
    expect(file.includes(Buffer.from("word/document.xml"))).toBe(true);
  });

  it("zvládne text s hvězdičkami i prázdnými řádky", async () => {
    const file = await contractToDocx({
      text: "SMLOUVA\n\n**Tučně**\n\nI. ČLÁNEK\n\n   1. Odsazeno\n",
      title: "Test",
    });

    expect(file.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("nespadne na prázdném textu", async () => {
    const file = await contractToDocx({ text: "", title: "Test" });

    expect(file.length).toBeGreaterThan(0);
  });
});

describe("název souboru", () => {
  it("zbaví se diakritiky a mezer", () => {
    expect(contractFileName("Nový web pekárny")).toBe(
      "smlouva-novy-web-pekarny.docx",
    );
  });

  it("u nesmyslného názvu dá aspoň něco", () => {
    expect(contractFileName("///")).toBe("smlouva-zakazka.docx");
  });
});

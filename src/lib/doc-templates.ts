import { formatDay } from "@/lib/format";

/**
 * Předlohy dokumentů. Držíme je v aplikaci, ne v Drive — s oprávněním
 * drive.file aplikace na soubory, které sama nevytvořila, nevidí, takže by
 * šablonu z Drive nedokázala zkopírovat.
 *
 * Docs API vkládá čistý text, žádné formátování. Proto jsou předlohy psané
 * jako osnova, kterou si člověk v Docs doformátuje.
 */
export type DocTemplateKey = "prazdny" | "nabidka" | "zapis" | "akceptace";

export type DocContext = {
  clientName: string;
  contactPerson: string | null;
  projectName: string;
  phaseName: string | null;
  authorName: string;
  today: Date;
};

type Template = {
  key: DocTemplateKey;
  label: string;
  title: (context: DocContext) => string;
  body: (context: DocContext) => string;
};

function head(context: DocContext, heading: string): string {
  return [
    heading,
    "",
    `Klient: ${context.clientName}`,
    context.contactPerson ? `Kontaktní osoba: ${context.contactPerson}` : null,
    `Zakázka: ${context.projectName}`,
    context.phaseName ? `Fáze: ${context.phaseName}` : null,
    `Datum: ${formatDay(context.today)}`,
    `Zpracoval: ${context.authorName}`,
    "",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

const TEMPLATES: Template[] = [
  {
    key: "prazdny",
    label: "Prázdný dokument",
    title: (context) => `${context.clientName} — ${context.projectName}`,
    body: () => "",
  },
  {
    key: "nabidka",
    label: "Nabídka",
    title: (context) => `Nabídka — ${context.clientName}`,
    body: (context) =>
      [
        head(context, "NABÍDKA"),
        "Co je předmětem",
        "- ",
        "",
        "Co nabídka nezahrnuje",
        "- ",
        "",
        "Termíny",
        "- Zahájení: ",
        "- Předání: ",
        "",
        "Cena",
        "- Práce: ",
        "- Provoz (hosting, domény, licence): ",
        "",
        "Co potřebujeme od klienta",
        "- Texty a fotografie",
        "- Přístupy k doméně a stávajícímu webu",
        "",
        "Platnost nabídky: 30 dní od data uvedeného výše.",
      ].join("\n"),
  },
  {
    key: "zapis",
    label: "Zápis ze schůzky",
    title: (context) =>
      `Zápis ze schůzky ${formatDay(context.today)} — ${context.clientName}`,
    body: (context) =>
      [
        head(context, "ZÁPIS ZE SCHŮZKY"),
        "Účastníci",
        "- ",
        "",
        "Co jsme probrali",
        "- ",
        "",
        "Na čem jsme se dohodli",
        "- ",
        "",
        "Úkoly a termíny",
        "- Kdo / co / do kdy",
        "",
        "Otevřené otázky",
        "- ",
      ].join("\n"),
  },
  {
    key: "akceptace",
    label: "Akceptační protokol",
    title: (context) =>
      `Akceptační protokol — ${context.projectName} (${context.clientName})`,
    body: (context) =>
      [
        head(context, "AKCEPTAČNÍ PROTOKOL"),
        "Předmět akceptace",
        "- ",
        "",
        "Co bylo předáno",
        "- ",
        "",
        "Zjištěné výhrady",
        "- Bez výhrad / seznam výhrad a termín odstranění",
        "",
        "Prohlášení",
        "Klient potvrzuje, že předané dílo odpovídá zadání a přejímá ho.",
        "",
        "Datum a podpis za klienta: ",
        "Datum a podpis za dodavatele: ",
      ].join("\n"),
  },
];

export const DOC_TEMPLATES = TEMPLATES.map(({ key, label }) => ({
  key,
  label,
}));

export function docTemplate(key: string): Template | null {
  return TEMPLATES.find((template) => template.key === key) ?? null;
}

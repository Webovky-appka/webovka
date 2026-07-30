/**
 * Údaje pro zásady ochrany osobních údajů a podmínky užívání. Drží se na jednom
 * místě, protože se objevují na obou stránkách a mění se zřídka.
 *
 * Prázdná hodnota znamená „ještě nedoplněno“ — stránky to napíšou nahoře jako
 * upozornění, ať se nedokončený dokument nedostane ke klientovi ani do souhlasné
 * obrazovky Googlu.
 */
export const SERVICE_NAME = "Mitsov Web";

export const OPERATOR = {
  /** Jméno nebo firma včetně právní formy, například „Jan Novák“ nebo „Studio s.r.o.“ */
  name: "",
  ico: "",
  /** Nechte prázdné, pokud nejste plátce DPH. */
  vatId: "",
  /** Sídlo v jednom řádku: ulice a číslo, město, PSČ. */
  address: "",
  /** Adresa pro dotazy k osobním údajům. */
  privacyEmail: "",
} as const;

/** Datum účinnosti. Při každé věcné změně dokumentů se posouvá. */
export const EFFECTIVE_DATE = "29. 7. 2026";

type MissingField = { label: string; hint: string };

const REQUIRED: { key: keyof typeof OPERATOR; field: MissingField }[] = [
  {
    key: "name",
    field: { label: "provozovatel", hint: "jméno nebo firma včetně právní formy" },
  },
  { key: "ico", field: { label: "IČO", hint: "identifikační číslo" } },
  { key: "address", field: { label: "sídlo", hint: "ulice, město, PSČ" } },
  {
    key: "privacyEmail",
    field: { label: "kontaktní e-mail", hint: "adresa pro dotazy k osobním údajům" },
  },
];

/** Co ještě chybí, než jde dokument zveřejnit. Prázdné pole = hotovo. */
export function missingOperatorFields(): MissingField[] {
  return REQUIRED.filter(({ key }) => OPERATOR[key].trim() === "").map(
    ({ field }) => field,
  );
}

/** Zpracovatelé, kterým se údaje dostávají. Vychází z toho, co aplikace opravdu volá. */
export const PROCESSORS = [
  {
    name: "Vercel Inc.",
    purpose: "provoz aplikace a úložiště příloh",
    data: "vše, co aplikace zobrazuje a ukládá jako soubor",
  },
  {
    name: "Neon Inc.",
    purpose: "databáze",
    data: "všechny záznamy o klientech, zakázkách a komunikaci",
  },
  {
    name: "Resend, Inc.",
    purpose: "odesílání upozornění e-mailem",
    data: "adresa příjemce a text upozornění",
  },
  {
    name: "OpenAI, L.L.C.",
    purpose: "návrh textu e-mailu, jen když si ho vyžádáte",
    data: "podklady o zakázce a posledních pět zpráv z komunikace",
  },
  {
    name: "Google LLC",
    purpose: "odeslání e-mailu z vaší adresy a založení dokumentu v Google Docs",
    data: "text zprávy a adresa příjemce, název a obsah zakládaného dokumentu",
  },
] as const;

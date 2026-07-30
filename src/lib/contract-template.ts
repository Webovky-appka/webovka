import { formatDay } from "@/lib/format";

/**
 * Šablona smlouvy o dílo. Text je schválně tady v kódu, ne v hlavě modelu —
 * model dostane hotovou smlouvu a smí ji upravit, ale nesmí ji psát od nuly.
 * Jinak by se u třetího klienta beze slova vytratil odstavec o odpovědnosti.
 *
 * TOHLE NENÍ PRÁVNÍ SLUŽBA. Šablonu musí před prvním použitím projít právník;
 * u vymáhání peněz a autorských práv rozhoduje formulace.
 */

/** Kdo dílo dodává. Údaje se berou z proměnných prostředí, chybějící se označí. */
export type Supplier = {
  name: string;
  ico: string;
  dic: string | null;
  address: string;
  bankAccount: string;
  representedBy: string;
};

export type ContractClient = {
  companyName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  ico: string | null;
  address: string | null;
};

export type ContractPhase = {
  name: string;
  dueDate: Date | null;
  /** Podíl z ceny po odečtení zálohy, v procentech. */
  share: number;
};

export type ContractParams = {
  supplier: Supplier;
  client: ContractClient;
  projectName: string;
  /** Cena bez DPH v Kč. */
  totalPrice: number;
  depositPercent: number;
  hourlyRate: number;
  revisionsPerPhase: number;
  phases: ContractPhase[];
  /** Kolik dní má klient na zaplacení faktury. */
  paymentDays: number;
};

export const MISSING = "[DOPLŇTE]";

/**
 * Výchozí obchodní podmínky. Patří sem, ne do modulu se Server Actions —
 * ten smí exportovat jen funkce a v prohlížeči by z konstanty bylo undefined.
 */
export const CONTRACT_DEFAULTS = {
  depositPercent: 30,
  revisionsPerPhase: 2,
  paymentDays: 14,
  hourlyRate: 900,
} as const;

const money = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
});

export function formatCzk(amount: number): string {
  return `${money.format(Math.round(amount))} Kč`;
}

/**
 * Rozpočítá cenu na zálohu a jednotlivé fáze. Zbytek po zaokrouhlení se
 * přidá k poslední fázi, aby součet dal přesně cenu — jinak by ve smlouvě
 * chyběly nebo přebývaly koruny.
 */
export function splitPrice(params: {
  totalPrice: number;
  depositPercent: number;
  phases: ContractPhase[];
}): { deposit: number; phases: { name: string; amount: number }[] } {
  const deposit = Math.round(
    (params.totalPrice * params.depositPercent) / 100,
  );
  const rest = params.totalPrice - deposit;

  const shareSum = params.phases.reduce((sum, phase) => sum + phase.share, 0);
  if (params.phases.length === 0 || shareSum <= 0) {
    return { deposit, phases: [] };
  }

  const amounts = params.phases.map((phase) =>
    Math.round((rest * phase.share) / shareSum),
  );

  // Rozdíl ze zaokrouhlení dorovnáme na poslední fázi.
  const diff = rest - amounts.reduce((sum, amount) => sum + amount, 0);
  amounts[amounts.length - 1] = amounts[amounts.length - 1]! + diff;

  return {
    deposit,
    phases: params.phases.map((phase, index) => ({
      name: phase.name,
      amount: amounts[index]!,
    })),
  };
}

/** Rovnoměrné rozdělení podílů mezi fáze. Používá se, dokud je uživatel nezmění. */
export function equalShares(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => Math.round(100 / count));
}

function party(label: string, lines: (string | null)[]): string[] {
  return [label, ...lines.filter((line): line is string => Boolean(line))];
}

export function buildContract(params: ContractParams): string {
  const { supplier, client, phases } = params;
  const split = splitPrice(params);

  const lines: string[] = [
    "SMLOUVA O DÍLO",
    "",
    `uzavřená podle § 2586 a následujících zákona č. 89/2012 Sb., občanský zákoník`,
    "",
    "I. SMLUVNÍ STRANY",
    "",
    ...party("Zhotovitel:", [
      supplier.name,
      `IČO: ${supplier.ico}`,
      supplier.dic ? `DIČ: ${supplier.dic}` : null,
      `Sídlo: ${supplier.address}`,
      `Bankovní spojení: ${supplier.bankAccount}`,
      `Zastoupený: ${supplier.representedBy}`,
    ]),
    "",
    ...party("Objednatel:", [
      client.companyName,
      `IČO: ${client.ico ?? MISSING}`,
      `Sídlo: ${client.address ?? MISSING}`,
      client.contactPerson ? `Kontaktní osoba: ${client.contactPerson}` : null,
      client.email ? `E-mail: ${client.email}` : null,
      client.phone ? `Telefon: ${client.phone}` : null,
    ]),
    "",
    "II. PŘEDMĚT SMLOUVY",
    "",
    `1. Zhotovitel se zavazuje zhotovit pro objednatele dílo: ${params.projectName}.`,
    "2. Dílo se provádí po etapách uvedených v článku III. Rozsah každé etapy vychází ze zadání odsouhlaseného oběma stranami.",
    "3. Objednatel se zavazuje dílo převzít a zaplatit sjednanou cenu.",
    "",
    "III. ETAPY A TERMÍNY",
    "",
  ];

  phases.forEach((phase, index) => {
    const due = phase.dueDate
      ? `předpokládaný termín dokončení ${formatDay(phase.dueDate)}`
      : "termín dokončení bude dohodnut písemně";
    lines.push(`${index + 1}. ${phase.name} — ${due}.`);
  });

  lines.push(
    "",
    "Etapa je dokončena, jakmile ji zhotovitel předá objednateli k odsouhlasení a objednatel ji odsouhlasí, nebo neuplatní-li objednatel k etapě písemné připomínky do deseti pracovních dnů od předání.",
    "",
    "IV. CENA A PLATEBNÍ PODMÍNKY",
    "",
    `1. Cena díla je ${formatCzk(params.totalPrice)} bez DPH.`,
    `2. Záloha ve výši ${params.depositPercent} % ceny, tedy ${formatCzk(split.deposit)}, je splatná do ${params.paymentDays} dnů od podpisu této smlouvy. Zhotovitel začne pracovat po jejím zaplacení.`,
    "3. Zbytek ceny se hradí po etapách takto:",
  );

  split.phases.forEach((phase, index) => {
    lines.push(`   ${index + 1}. ${phase.name}: ${formatCzk(phase.amount)}`);
  });

  lines.push(
    "",
    `4. Zhotovitel vystaví fakturu po dokončení etapy. Splatnost faktury je ${params.paymentDays} dnů.`,
    "5. Je-li objednatel v prodlení s platbou, není zhotovitel povinen pokračovat v další etapě a termíny podle článku III. se prodlužují o dobu prodlení.",
    "6. Při prodlení s platbou má zhotovitel právo na úrok z prodlení ve výši 0,05 % z dlužné částky za každý den prodlení.",
    "",
    "V. ÚPRAVY A VÍCEPRÁCE",
    "",
    `1. V ceně každé etapy jsou zahrnuta ${params.revisionsPerPhase} kola úprav na základě připomínek objednatele.`,
    `2. Další úpravy nad tento rozsah a práce nad rámec odsouhlaseného zadání se účtují hodinovou sazbou ${formatCzk(params.hourlyRate)} bez DPH. Zhotovitel objednatele na vícepráce předem upozorní a vyčká jeho písemného souhlasu.`,
    "3. Rozšíření zadání v průběhu etapy může posunout termíny podle článku III. Zhotovitel navrhne nový termín písemně.",
    "",
    "VI. SOUČINNOST OBJEDNATELE",
    "",
    "1. Objednatel dodá podklady potřebné pro dílo, zejména texty, obrázky, loga a přístupy k doméně a hostingu.",
    "2. Objednatel odpovídá za to, že je oprávněn dodané podklady použít a poskytnout je zhotoviteli, a že jejich užitím nedojde k porušení práv třetích osob. Vznikne-li zhotoviteli z tohoto důvodu škoda, nahradí ji objednatel.",
    "3. Prodlení objednatele s dodáním podkladů nebo s odsouhlasením etapy staví termíny podle článku III. o dobu prodlení.",
    "",
    "VII. LICENCE A PŘEDÁNÍ DÍLA",
    "",
    "1. Zhotovitel poskytuje objednateli k dílu výhradní licenci bez omezení územního a časového, a to v rozsahu potřebném k užívání díla k jeho účelu.",
    "2. **Licence přechází na objednatele až úplným zaplacením celé ceny díla.** Do té doby smí objednatel dílo užívat pouze pro účely odsouhlasení etap.",
    "3. Zhotovitel je oprávněn uvést dílo ve svém portfoliu a označit se jako jeho autor, nedohodnou-li se strany písemně jinak.",
    "4. Části díla, k nimž zhotovitel nemá autorská práva, zejména software třetích stran, fonty a fotografie z licenčních bank, se řídí licenčními podmínkami jejich poskytovatelů. Zhotovitel objednatele o takových částech informuje.",
    "",
    "VIII. ODPOVĚDNOST",
    "",
    "1. Zhotovitel odpovídá za to, že dílo bude v době předání odpovídat odsouhlasenému zadání.",
    "2. Zhotovitel neodpovídá za obsah, který do díla vloží objednatel, ani za škodu vzniklou zásahem objednatele nebo třetí osoby do díla po jeho předání.",
    "3. Náhrada škody, kterou zhotovitel objednateli způsobí, je omezena do výše ceny, kterou objednatel podle této smlouvy skutečně zaplatil. To se nevztahuje na škodu způsobenou úmyslně nebo z hrubé nedbalosti.",
    "4. Zhotovitel neodpovídá za dostupnost služeb třetích stran, zejména hostingu, doménového registrátora a platebních služeb.",
    "",
    "IX. UKONČENÍ SMLOUVY",
    "",
    "1. Smlouvu lze ukončit písemnou dohodou stran.",
    "2. Kterákoli strana může od smlouvy odstoupit, poruší-li druhá strana smlouvu podstatným způsobem a nezjedná-li nápravu do čtrnácti dnů od písemného vyzvání. Za podstatné porušení se považuje prodlení objednatele s platbou o více než třicet dnů.",
    "3. Při ukončení smlouvy před dokončením díla zaplatí objednatel cenu dokončených etap a poměrnou část ceny rozpracované etapy. Zaplacené zálohy se zúčtují.",
    "",
    "X. ZÁVĚREČNÁ USTANOVENÍ",
    "",
    "1. Smlouva se řídí právem České republiky.",
    "2. Změny smlouvy vyžadují písemnou formu. Za písemnou formu se považuje i e-mail z adres uvedených v článku I.",
    "3. Smlouva nabývá platnosti a účinnosti dnem podpisu obou stran.",
    "4. Strany si smlouvu přečetly a souhlasí s jejím obsahem.",
    "",
    "",
    `V ${MISSING} dne ${MISSING}`,
    "",
    "",
    "_______________________          _______________________",
    `${supplier.name}                 ${client.companyName}`,
    "Zhotovitel                       Objednatel",
  );

  return lines.join("\n");
}

/** Údaje zhotovitele z proměnných prostředí. Co chybí, označí se k doplnění. */
export function supplierFromEnv(fallbackName: string): Supplier {
  return {
    name: process.env.STUDIO_NAME ?? fallbackName,
    ico: process.env.STUDIO_ICO ?? MISSING,
    dic: process.env.STUDIO_DIC ?? null,
    address: process.env.STUDIO_ADDRESS ?? MISSING,
    bankAccount: process.env.STUDIO_BANK_ACCOUNT ?? MISSING,
    representedBy: process.env.STUDIO_REPRESENTED_BY ?? fallbackName,
  };
}

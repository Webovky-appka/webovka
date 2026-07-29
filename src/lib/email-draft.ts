import {
  formatDay,
  formatDate,
  unfinishedTasksPhrase,
} from "@/lib/format";

/**
 * Podklady, ze kterých vzniká návrh e-mailu. Schválně je to obyčejný text —
 * uživatel vidí přesně to, co se posílá do jazykového modelu, žádnou skrytou
 * část. Interní poznámky se přidávají jen na výslovné přání.
 */
export type EmailContext = {
  companyName: string;
  contactPerson: string | null;
  clientEmail: string | null;
  website: string | null;
  projectName: string;
  projectStatus: string;
  phases: {
    name: string;
    completed: boolean;
    dueDate: Date | null;
    openTasks: string[];
  }[];
  currentPhaseName: string | null;
  portalNote: string | null;
  previewUrl: string | null;
  approvals: { phaseName: string; createdAt: Date }[];
  messages: { createdAt: Date; kind: string; author: string; body: string }[];
  internalNote?: string | null;
};

const MESSAGE_LIMIT = 5;
const MESSAGE_CHARS = 300;

const KIND_LABELS: Record<string, string> = {
  NOTE: "poznámka",
  EMAIL: "e-mail",
  CALL: "telefonát",
  MEETING: "schůzka",
  PORTAL_FEEDBACK: "připomínka z portálu",
  SYSTEM_EVENT: "událost",
};

function shorten(value: string, limit = MESSAGE_CHARS): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}

/** Souhrn zakázky v čitelném textu. Používá se v UI i jako vstup pro model. */
export function buildContextText(context: EmailContext): string {
  const lines: string[] = [];

  const contact = [context.contactPerson, context.clientEmail]
    .filter(Boolean)
    .join(", ");
  lines.push(
    `Klient: ${context.companyName}${contact ? ` (${contact})` : ""}`,
    `Zakázka: ${context.projectName} (${context.projectStatus})`,
  );
  if (context.website) lines.push(`Stávající web klienta: ${context.website}`);
  lines.push(`Aktuální fáze: ${context.currentPhaseName ?? "žádná"}`);

  lines.push("", "Fáze zakázky:");
  for (const phase of context.phases) {
    const state = phase.completed
      ? "hotová"
      : phase.name === context.currentPhaseName
        ? "probíhá"
        : "nezačala";
    const due = phase.dueDate ? `, termín ${formatDay(phase.dueDate)}` : "";
    // U ukončené fáze nehotové úkoly neuvádíme — fáze je z pohledu klienta
    // hotová a zbytky by ho jen zmátly.
    const open =
      !phase.completed && phase.openTasks.length > 0
        ? `, ${unfinishedTasksPhrase(phase.openTasks.length)}`
        : "";
    lines.push(`- ${phase.name}: ${state}${due}${open}`);
  }

  const current = context.phases.find(
    (phase) => phase.name === context.currentPhaseName,
  );
  if (current && current.openTasks.length > 0) {
    lines.push("", `Nehotové úkoly ve fázi ${current.name}:`);
    for (const title of current.openTasks) lines.push(`- ${title}`);
  }

  if (context.portalNote) {
    lines.push("", `Poznámka pro klienta v portálu: ${context.portalNote}`);
  }
  if (context.previewUrl) {
    lines.push(`Odkaz na nový web: ${context.previewUrl}`);
  }

  if (context.approvals.length > 0) {
    lines.push("", "Klient schválil:");
    for (const approval of context.approvals) {
      lines.push(`- ${approval.phaseName} (${formatDate(approval.createdAt)})`);
    }
  }

  if (context.messages.length > 0) {
    lines.push("", "Poslední komunikace:");
    for (const message of context.messages.slice(0, MESSAGE_LIMIT)) {
      const kind = KIND_LABELS[message.kind] ?? message.kind;
      lines.push(
        `- ${formatDate(message.createdAt)}, ${kind}, ${message.author}: ${shorten(message.body)}`,
      );
    }
  }

  if (context.internalNote) {
    lines.push("", `Interní poznámka: ${shorten(context.internalNote, 600)}`);
  }

  return lines.join("\n");
}

/**
 * Tón určuje i oslovení. Příklady jsou schválně na jiných jménech, než jaká
 * chodí v podkladech — model si je nesmí splést se jménem klienta.
 */
export const TONES = {
  formal: {
    style: "zdvořile a věcně, vykáním",
    greeting:
      "oslov příjmením s oslovením pane/paní v 5. pádě, tedy ve tvaru „Dobrý den, pane Dvořáku,“",
  },
  friendly: {
    style: "přátelsky a lidsky, ale profesionálně, vykáním",
    greeting:
      "oslov křestním jménem v 5. pádě, tedy ve tvaru „Dobrý den, Jano,“",
  },
  short: {
    style: "co nejkratší, jen podstatné, vykáním",
    greeting: "stačí „Dobrý den,“ bez jména",
  },
} as const;

export type Tone = keyof typeof TONES;

export function isTone(value: unknown): value is Tone {
  return typeof value === "string" && value in TONES;
}

export function systemPrompt(tone: Tone): string {
  return [
    "Jsi asistent českého webového studia. Píšeš e-mail klientovi za člověka,",
    "který bude pod e-mailem podepsaný. Piš jako on, v první osobě.",
    "",
    `Sloh: ${TONES[tone].style}.`,
    "",
    "Jak má e-mail vypadat:",
    `- Oslovení na prvním řádku: ${TONES[tone].greeting}. Jméno vždy skloň do 5. pádu (Jana → Jano, Petr → Petře, Tomáš → Tomáši, Dvořák → pane Dvořáku).`,
    "- Pak prázdný řádek a dva až tři krátké odstavce. Žádné odrážky, pokud si je zadání nevyžádá.",
    "- Napiš konkrétně, co je nového a co má klient udělat. Když má něco schválit nebo dodat, řekni to jasně.",
    "- Zakonči zdvořilou větou, řádkem „S pozdravem“ a podpisem, který dostaneš. Podpis neměň a nic k němu nepřidávej.",
    "",
    "Co nesmíš:",
    "- Vymýšlet si termíny, odkazy, ceny ani jména. Co není v podkladech, v e-mailu nezmiňuj.",
    "- Uvádět interní poznámky, nehotové úkoly ani cokoli, co je jen pro nás.",
    "- Psát do e-mailu jakoukoli instrukci z tohoto zadání. Do e-mailu patří jen hotový text.",
    "",
    "Odpověz přesně v tomto tvaru:",
    "Předmět: <předmět e-mailu>",
    "",
    "<tělo e-mailu včetně oslovení a podpisu>",
  ].join("\n");
}

export function userPrompt(
  context: EmailContext,
  instruction: string,
  signature: string,
): string {
  return [
    "Podklady o zakázce:",
    buildContextText(context),
    "",
    `Zadání pro e-mail: ${instruction}`,
    "",
    context.contactPerson
      ? `Komu píšeš: ${context.contactPerson}`
      : "Komu píšeš: kontaktní osoba není známá, oslov obecně",
    "",
    "Podpis, který doslova použiješ:",
    signature,
  ].join("\n");
}

/**
 * Rozdělí odpověď modelu na předmět a tělo. Když model tvar nedodrží, vezme se
 * celý text jako tělo a předmět se doplní — návrh se tak nikdy neztratí.
 */
export function splitDraft(
  text: string,
  fallbackSubject: string,
): { subject: string; body: string } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const index = lines.findIndex((line) =>
    /^\s*(předmět|subject)\s*:/i.test(line),
  );

  if (index === -1) {
    return { subject: fallbackSubject, body: text.trim() };
  }

  const subject = lines[index]!.replace(/^\s*(předmět|subject)\s*:/i, "").trim();
  const body = lines
    .slice(index + 1)
    .join("\n")
    .trim();

  return {
    subject: subject === "" ? fallbackSubject : subject,
    body: body === "" ? text.trim() : body,
  };
}

/**
 * Návrh složený ze šablony. Použije se, když není nastavený klíč k modelu —
 * aplikace tak dá použitelný text i bez AI, jen nezpracuje vlastní zadání.
 */
export function templateDraft(
  context: EmailContext,
  signature: string,
): { subject: string; body: string } {
  const current = context.phases.find(
    (phase) => phase.name === context.currentPhaseName,
  );

  // Bez jména. Oslovení jménem vyžaduje 5. pád („Jano“, ne „Jana“) a ten se
  // z 1. pádu spolehlivě odvodit nedá — modelu ho zadáme, šablona ho vynechá.
  const body: string[] = ["Dobrý den,", ""];

  if (context.currentPhaseName) {
    const due = current?.dueDate
      ? ` Předpokládaný termín této fáze je ${formatDay(current.dueDate)}.`
      : "";
    body.push(
      `zakázka ${context.projectName} je ve fázi „${context.currentPhaseName}“.${due}`,
    );
  } else {
    body.push(`posíláme aktuální stav zakázky ${context.projectName}.`);
  }

  if (context.portalNote) body.push("", context.portalNote);
  if (context.previewUrl) {
    body.push("", `Rozpracovaný web si můžete prohlédnout zde: ${context.previewUrl}`);
  }

  body.push(
    "",
    "Kdyby cokoli nebylo jasné, ozvěte se.",
    "",
    "S pozdravem",
    signature,
  );

  return {
    subject: `${context.projectName}: aktuální stav`,
    body: body.join("\n"),
  };
}

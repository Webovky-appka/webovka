import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
import { buildSampleBlock, type EmailSample } from "@/lib/sales/email-samples";
import { usableInOutreach, type EvidenceItem } from "@/lib/sales/evidence";
import {
  RESEARCH_CATEGORY_LABELS,
  type ResearchHook,
} from "@/lib/sales/research-hooks";

/**
 * Sestavení podkladů pro Outreach — čistý modul, aby šlo testovat, že se
 * k modelu nikdy nedostane úsudek AI vydávaný za fakt (sekce 26 specifikace).
 * E-mail smí stavět jen na pozorovaném a odvozeném; dojmy modelu z auditu
 * do podkladů nepatří vůbec, ani jako „kontext".
 */

/**
 * Kolik textu smí mít pokyn pro AI úpravu návrhu. Původních 500 znaků bylo
 * na vysvětlení, co se má přepsat, málo — tohle je zhruba tisíc slov.
 */
export const MAX_INSTRUCTION_CHARS = 6000;

export const OUTREACH_STRATEGIES = ["visual", "observation", "business"] as const;

export type OutreachStrategy = (typeof OUTREACH_STRATEGIES)[number];

export const STRATEGY_LABELS: Record<OutreachStrategy, string> = {
  visual: "Vizuální — návrh, jak by web mohl vypadat",
  observation: "Pozorování — konkrétní postřeh z webu",
  business: "Obchodní — reaguje na dění ve firmě",
};

export function isOutreachStrategy(value: unknown): value is OutreachStrategy {
  return (
    typeof value === "string" &&
    (OUTREACH_STRATEGIES as readonly string[]).includes(value)
  );
}

export type OutreachFacts = {
  companyName: string;
  domain: string | null;
  industry: string | null;
  location: string | null;
  reason: string | null;
  mission: string;
  contact: { name: string | null; role: string | null } | null;
  problems: { title: string; explanation: string; severity: string }[];
  recommendation: string | null;
  evidence: EvidenceItem[];
  researchHooks: ResearchHook[];
  /**
   * Doménu známe, ale web se nepodařilo načíst (mrtvý, rozbitý, blokuje).
   * Audit tedy neexistuje — a nedostupnost je sama silný argument.
   */
  siteUnreachable: boolean;
  /** Ke zprávě bude přiložený JPEG koncept nové homepage od Designera. */
  hasMockup: boolean;
  /** Vzorové e-maily z Nastavení — ukázka tónu, ne zdroj faktů. */
  samples: EmailSample[];
  senderName: string;
};

export function buildOutreachInput(facts: OutreachFacts): string {
  const usable = usableInOutreach(facts.evidence);
  const noOwnWebsite = !facts.domain || isSharedPlatformDomain(facts.domain);

  // Do e-mailu smí jen pozorované a odvozené háčky — dojem modelu
  // („působí zavedeně“) není fakt o firmě, stejná hranice jako u auditu.
  const usableHooks = facts.researchHooks
    .filter((hook) => hook.kind === "OBSERVED" || hook.kind === "DERIVED")
    .slice(0, 5);

  // Nejvýš dva nejvážnější problémy — e-mail má zmínit jedno až dvě
  // pozorování, ne vysypat celý audit (sekce 13.1).
  const order = { high: 0, medium: 1, low: 2 } as const;
  const topProblems = [...facts.problems]
    .sort(
      (a, b) =>
        (order[a.severity as keyof typeof order] ?? 3) -
        (order[b.severity as keyof typeof order] ?? 3),
    )
    .slice(0, 2);

  return [
    `Firma: ${facts.companyName}${facts.domain ? ` (${facts.domain})` : ""}`,
    `Obor a místo: ${facts.industry ?? "?"}, ${facts.location ?? "?"}`,
    `Proč ji oslovujeme: ${facts.reason ?? "bez zdůvodnění"}`,
    `Mise kampaně: ${facts.mission}`,
    "",
    facts.contact
      ? `Adresát: ${facts.contact.name ?? "jméno neznámé"}${facts.contact.role ? ` (${facts.contact.role})` : ""}`
      : "Adresát: neznámý, oslov obecně",
    "",
    ...(noOwnWebsite
      ? [
          `Vlastní web firmy jsme při hledání NENAŠLI${facts.domain ? ` — známe jen stránku ${facts.domain}` : ""}.`,
          "Hlavní nabídka: postavíme jí první vlastní web. Argumenty: zákazníci",
          "z Googlu ji dnes těžko najdou, je závislá na cizí platformě a nemá",
          "vlastní rezervace/objednávky. NEpiš o „vylepšení webu“ a NIKDY netvrď",
          "absolutně „nemáte web“ — formuluj jako „nepodařilo se nám najít váš",
          "web“. Když se mýlíme, zdvořilá formulace nás zachrání.",
          "",
        ]
      : []),
    ...(usableHooks.length > 0
      ? [
          "Čerstvé háčky o firmě z researche (na úvod „proč píšu právě vám“ vyber NEJVÝŠ JEDEN, nejlépe nejčerstvější):",
          ...usableHooks.map(
            (hook) =>
              `- [${RESEARCH_CATEGORY_LABELS[hook.category]}] ${hook.claim} [${hook.source}]`,
          ),
          "",
        ]
      : []),
    ...(facts.siteUnreachable
      ? [
          `Web ${facts.domain} jsme našli, ale NENAČETL SE nám — opakovaně.`,
          "To je to hlavní, o čem e-mail bude: když se nenačte nám, nenačte se",
          "ani zákazníkovi, který na něj klikne v Googlu nebo na vizitce.",
          "Formuluj to zdvořile a jako pozorování, ne obvinění: „zkoušel jsem",
          "otevřít váš web a nenačetl se mi“. Připusť, že to může být chvilkový",
          "výpadek — právě proto se ptáme. Nabídni, že web zprovozníme nebo",
          "postavíme nový. NIKDY nehodnoť vzhled ani obsah, neviděli jsme ho.",
          "",
        ]
      : []),
    "Ověřená pozorování z webu (jen tato smíš v e-mailu tvrdit):",
    ...(usable.length > 0
      ? usable.map((item) => `- ${item.claim} [${item.source}]`)
      : noOwnWebsite
        ? [
            "- vlastní web firmy se nám nepodařilo najít — jediné tvrzení o „webu“, které smíš použít, a jen touto formulací",
          ]
        : facts.siteUnreachable
          ? [
              `- web ${facts.domain} se nám opakovaně nenačetl — jediné, co o jejich webu smíš tvrdit`,
            ]
          : ["- žádná — piš obecněji a nic o webu netvrď"]),
    "",
    "Hlavní problémy z auditu (interní kontext, vyber nejvýš 1–2 a formuluj zdvořile):",
    ...(topProblems.length > 0
      ? topProblems.map(
          (problem) => `- ${problem.title}: ${problem.explanation}`,
        )
      : ["- žádné"]),
    "",
    facts.recommendation
      ? `Naše doporučení z auditu: ${facts.recommendation}`
      : "Bez doporučení.",
    "",
    ...(facts.hasMockup
      ? [
          "K e-mailu přiložíme obrázek s konceptem, jak by jejich nová homepage mohla vypadat.",
          "Zmiň ho přesně jednou větou (např. „do přílohy posílám rychlý koncept, jak by váš web mohl",
          "vypadat — ber ho prosím jen jako první nástřel“) a zvol strategii visual.",
          "",
        ]
      : []),
    // Vzory až za fakty: model si nejdřív načte, co o firmě smí tvrdit,
    // a teprve pak dostane ukázku, jak to má znít.
    ...buildSampleBlock(facts.samples),
    // Podpis přesně podle předlohy majitele studia: rozloučení, jméno, studio.
    // Bez jména (fallback) zůstane jen studio, ať nevznikne „Mitsov Web,
    // Mitsov Web".
    facts.senderName === "Mitsov Web"
      ? "Podepiš přesně takto, na dva řádky: „S pozdravem“ / „Mitsov Web“."
      : `Podepiš přesně takto, na tři řádky: „S pozdravem“ / „${facts.senderName}“ / „Mitsov Web“.`,
    "Vyber strategii hooku: visual / observation / business — podle toho, co máš v ruce.",
  ].join("\n");
}

import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
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
    "Ověřená pozorování z webu (jen tato smíš v e-mailu tvrdit):",
    ...(usable.length > 0
      ? usable.map((item) => `- ${item.claim} [${item.source}]`)
      : noOwnWebsite
        ? [
            "- vlastní web firmy se nám nepodařilo najít — jediné tvrzení o „webu“, které smíš použít, a jen touto formulací",
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
    // Když odesílá „Mitsov Web" (fallback bez jména), nesmí vzniknout
    // zdvojení „Mitsov Web, Mitsov Web" v podpisu.
    facts.senderName === "Mitsov Web"
      ? "Podepiš: Mitsov Web"
      : `Podepiš: ${facts.senderName}, Mitsov Web`,
    "Vyber strategii hooku: visual / observation / business — podle toho, co máš v ruce.",
  ].join("\n");
}

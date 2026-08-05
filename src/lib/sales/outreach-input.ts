import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
import { usableInOutreach, type EvidenceItem } from "@/lib/sales/evidence";

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
  senderName: string;
};

export function buildOutreachInput(facts: OutreachFacts): string {
  const usable = usableInOutreach(facts.evidence);
  const noOwnWebsite = !facts.domain || isSharedPlatformDomain(facts.domain);

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
          `Firma NEMÁ vlastní web${facts.domain ? ` — má jen stránku ${facts.domain}` : ""}.`,
          "Hlavní nabídka: postavíme jí první vlastní web. Argumenty: zákazníci",
          "z Googlu ji dnes nenajdou, je závislá na cizí platformě a nemá vlastní",
          "rezervace/objednávky. NEpiš o „vylepšení webu“ — žádný web nemá.",
          "",
        ]
      : []),
    "Ověřená pozorování z webu (jen tato smíš v e-mailu tvrdit):",
    ...(usable.length > 0
      ? usable.map((item) => `- ${item.claim} [${item.source}]`)
      : noOwnWebsite
        ? [
            "- firma nemá vlastní web (ověřeno Scoutem) — to je jediné tvrzení o „webu“, které smíš použít",
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

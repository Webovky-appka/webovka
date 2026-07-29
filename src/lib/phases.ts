/**
 * Fáze si pojmenovává uživatel u každé zakázky zvlášť, takže tady nezůstal
 * žádný pevný výčet. Následující názvy slouží jen jako výchozí předloha,
 * kterou seed vloží do PhaseTemplate a odkud se předvyplní nová zakázka.
 */
export const DEFAULT_PHASES: { name: string; tasks: string[] }[] = [
  {
    name: "Zadání",
    tasks: [
      "Podepsat smlouvu",
      "Získat podklady od klienta",
      "Získat přístupy k doméně",
      "Sepsat zadání a odsouhlasit rozsah",
    ],
  },
  {
    name: "Návrh",
    tasks: [
      "Navrhnout strukturu stránek",
      "Připravit grafický návrh homepage",
      "Odeslat návrh klientovi ke schválení",
    ],
  },
  {
    name: "Vývoj",
    tasks: [
      "Nasadit vývojové prostředí",
      "Naprogramovat šablony",
      "Naplnit obsahem",
      "Nastavit responzivitu a rychlost",
    ],
  },
  {
    name: "Schválení",
    tasks: [
      "Projít web s klientem",
      "Zapracovat připomínky",
      "Zkontrolovat texty a odkazy",
    ],
  },
  {
    name: "Live",
    tasks: [
      "Převést doménu na produkci",
      "Nastavit zálohy a monitoring",
      "Předat přístupy klientovi",
      "Vystavit koncovou fakturu",
    ],
  },
];

/** Minimální podoba fáze, se kterou pracují pomocné funkce i komponenty. */
export type PhaseLike = {
  id: string;
  name: string;
  position: number;
  completedAt: Date | null;
};

export function sortPhases<T extends { position: number }>(phases: T[]): T[] {
  return [...phases].sort((a, b) => a.position - b.position);
}

/**
 * Aktivní fáze je první neukončená. Když je hotové všechno, zůstane poslední —
 * zakázka se tím tváří jako dokončená, ne jako bez fáze.
 */
export function activePhase<T extends PhaseLike>(phases: T[]): T | null {
  const ordered = sortPhases(phases);
  return (
    ordered.find((phase) => phase.completedAt === null) ??
    ordered[ordered.length - 1] ??
    null
  );
}

export function isPhaseCompleted(phase: PhaseLike): boolean {
  return phase.completedAt !== null;
}

/** Barvy podle stavu, ne podle názvu — názvy si uživatel vymýšlí sám. */
export function phaseBadgeClasses(state: "done" | "active" | "future"): string {
  switch (state) {
    case "done":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    case "active":
      return "bg-sky-100 text-sky-700 ring-sky-200";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-200";
  }
}

/**
 * Známky majitele studia na škále kvality webu 0–100 a výběr kalibračních
 * vzorů pro audit. Čistý modul: potřebuje ho klientské tlačítko i server
 * (auditor a Nastavení) — konstanta exportovaná z „use client" modulu by
 * se na serveru chovala jako client reference.
 */

export type HumanGrade = { score: number; label: string; hint: string };

/**
 * Sedm stupňů, ať jde odstín poznat. Krajní hodnoty jsou schválně blízko
 * okrajů škály — model má tendenci mačkat všechno do středu a bez ostrých
 * konců by se laťka neposunula.
 */
export const HUMAN_GRADES: readonly HumanGrade[] = [
  { score: 10, label: "Katastrofa", hint: "rozbitý nebo dávno mrtvý web" },
  { score: 25, label: "Zastaralý", hint: "vypadá o deset let starší" },
  { score: 40, label: "Slabší", hint: "funguje, ale nic nedotažené" },
  { score: 55, label: "Průměrný", hint: "obstojný, bez nápadu" },
  { score: 70, label: "Solidní", hint: "dobrá práce, zbývají detaily" },
  { score: 85, label: "Výborný", hint: "těžko bychom udělali lépe" },
  { score: 95, label: "Špičkový", hint: "nemáme co nabídnout" },
] as const;

export function gradeFor(score: number): HumanGrade {
  return HUMAN_GRADES.reduce((best, grade) =>
    Math.abs(grade.score - score) < Math.abs(best.score - score) ? grade : best,
  );
}

/** Kolik ohodnocených webů se přikládá k jednomu auditu. */
export const CALIBRATION_LIMIT = 4;

export type RatedExample = { id: string; humanWebScore: number };

/**
 * Vybere vzory rozprostřené po škále, ne jen poslední ohodnocené. Model
 * potřebuje vidět oba konce laťky — kdyby dostal tři průměrné weby, naučí
 * se jen střed. Řadí se od nejhoršího k nejlepšímu, aby vzory šly po sobě.
 */
export function pickCalibrationExamples<T extends RatedExample>(
  rated: T[],
  limit: number = CALIBRATION_LIMIT,
): T[] {
  if (limit <= 0) return [];

  const sorted = [...rated].sort((a, b) => a.humanWebScore - b.humanWebScore);
  if (sorted.length <= limit) return sorted;

  // Rovnoměrné rozestupy včetně obou krajů: pro limit 4 to je 0, ⅓, ⅔, konec.
  const picked: T[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < limit; i += 1) {
    const index = Math.round((i * (sorted.length - 1)) / (limit - 1));
    if (seen.has(index)) continue;
    seen.add(index);
    picked.push(sorted[index]);
  }

  return picked;
}

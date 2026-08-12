/**
 * Skóre příležitosti. Dřív si číslo vymýšlel model sám, takže v něm nebyla
 * žádná logika — silná firma s hezkým webem mohla dostat víc než silná firma
 * s rozbitým webem. Teď je to vzorec ze dvou věcí, které model posuzuje
 * odděleně, a chování je vysvětlitelné i předvídatelné.
 *
 * Čistý modul: potřebuje ho server (kvalifikace, audit) i UI (vysvětlení).
 */

/**
 * Kalibrace do obvyklého rozsahu. Bez ní by typický cíl (silná firma 80,
 * slabý web 35) vyšel na 52 a propadl u prahu 60; s ní vychází 68.
 * Zvýšení nemění POŘADÍ příležitostí, jen posouvá celou škálu.
 */
export const OPPORTUNITY_GAIN = 1.3;

/**
 * Příležitost = síla firmy × jak moc web zaostává.
 *
 * - Silná firma se špatným webem = nejvyšší skóre (máme co nabídnout a je komu).
 * - Dobrý web skóre srazí, i když je firma silná — nemá cenu psát někomu,
 *   komu web nevylepšíme.
 * - Slabá firma nedostane vysoké skóre ani s rozbitým webem: nemá rozpočet.
 */
export function opportunityScore({
  businessStrength,
  websiteQuality,
}: {
  /** Síla a věrohodnost firmy 0–100. */
  businessStrength: number;
  /** Kvalita webu 0–100, vyšší = lepší web. */
  websiteQuality: number;
}): number {
  const strength = clamp(businessStrength);
  const quality = clamp(websiteQuality);
  const raw = (strength * (100 - quality)) / 100;
  return Math.min(100, Math.round(raw * OPPORTUNITY_GAIN));
}

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Věta do UI, ať je nad čísly vidět, odkud se skóre vzalo. */
export const SCORE_FORMULA_HINT =
  "Skóre = síla firmy × (100 − kvalita webu) / 100, přepočtené do obvyklého rozsahu. Silná firma se slabým webem má vysoké skóre; dobrý web ho srazí, i když je firma silná.";

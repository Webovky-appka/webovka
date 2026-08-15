/**
 * Připomínka druhého oslovení. Cold e-mail bez odpovědi není konec — druhý
 * dotek po měsíci je běžná praxe a hlavně se na něj snadno zapomene.
 *
 * Čistý modul: počítá se z data odeslání (SalesEmailDraft.sentAt) a ze stavu
 * příležitosti, nic dalšího. Používá ho detail, denní přehled i Zakázky.
 */

/** Po kolika dnech bez odpovědi má smysl napsat znovu. */
export const FOLLOW_UP_AFTER_DAYS = 30;

const DAY_MS = 86_400_000;

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
}

/**
 * Ozvat se znovu má smysl jen u příležitosti, která zůstala u oslovení.
 * Jakmile firma odpověděla, domluvila schůzku nebo dostala nabídku, jednání
 * běží a upomínka by byla otravná — a u vyhrané nebo prohrané nesmyslná.
 */
export function needsFollowUp({
  status,
  sentAt,
  now = new Date(),
  afterDays = FOLLOW_UP_AFTER_DAYS,
}: {
  status: string;
  sentAt: Date | null | undefined;
  now?: Date;
  afterDays?: number;
}): boolean {
  if (status !== "CONTACTED") return false;
  if (!sentAt) return false;
  return daysSince(sentAt, now) >= afterDays;
}

/** Věta do UI: kolik dní ticha a co s tím. */
export function followUpNote(sentAt: Date, now: Date = new Date()): string {
  const days = daysSince(sentAt, now);
  return `E-mail odešel před ${days} dny a nikdo neodpověděl. Druhý dotek se běžně vyplácí — napište krátce, bez výčitek.`;
}

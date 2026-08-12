/**
 * Barvy stavů příležitosti. Čistý modul — sdílí ho seznam v kampani, seznam
 * v běhu i detail, aby „Vyhrané" nebylo jednou zelené a jinde šedé.
 *
 * Klíčem je fáze, ne konkrétní stav: v přípravě neutrálně, po oslovení žlutě
 * (čeká se na člověka), výhra zeleně, prohra i zamítnutí červeně.
 */

export type LeadPhase = "prep" | "talking" | "won" | "lost";

const PHASE_BY_STATUS: Record<string, LeadPhase> = {
  DISCOVERED: "prep",
  QUALIFYING: "prep",
  QUALIFIED: "prep",
  RESEARCHING: "prep",
  READY_FOR_REVIEW: "prep",
  APPROVED: "talking",
  SCHEDULED: "talking",
  CONTACTED: "talking",
  REPLIED: "talking",
  MEETING: "talking",
  PROPOSAL: "talking",
  WON: "won",
  LOST: "lost",
  REJECTED: "lost",
};

export function leadPhase(status: string): LeadPhase {
  return PHASE_BY_STATUS[status] ?? "prep";
}

/** Barva nadpisu skupiny — výraznější, sekce se má poznat na první pohled. */
export const PHASE_HEADING_CLASS: Record<LeadPhase, string> = {
  prep: "text-slate-900",
  talking: "text-amber-700",
  won: "text-emerald-700",
  lost: "text-red-700",
};

/** Barva popisku stavu pod skóre — jemnější, ale stejná logika. */
export const PHASE_LABEL_CLASS: Record<LeadPhase, string> = {
  prep: "text-slate-500",
  talking: "font-medium text-amber-700",
  won: "font-medium text-emerald-700",
  lost: "font-medium text-red-600",
};

export function statusLabelClass(status: string): string {
  return PHASE_LABEL_CLASS[leadPhase(status)];
}

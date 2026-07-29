import { Phase } from "@prisma/client";

export const PHASE_ORDER: Phase[] = [
  Phase.BRIEF,
  Phase.DESIGN,
  Phase.BUILD,
  Phase.REVIEW,
  Phase.LIVE,
];

export const PHASE_LABELS: Record<Phase, string> = {
  BRIEF: "Zadání",
  DESIGN: "Návrh",
  BUILD: "Vývoj",
  REVIEW: "Schválení",
  LIVE: "Live",
};

/// Barvy odpovídají pořadí fází, aby šel stav poznat na první pohled.
export const PHASE_BADGE_CLASSES: Record<Phase, string> = {
  BRIEF: "bg-slate-100 text-slate-700 ring-slate-200",
  DESIGN: "bg-violet-100 text-violet-700 ring-violet-200",
  BUILD: "bg-amber-100 text-amber-800 ring-amber-200",
  REVIEW: "bg-sky-100 text-sky-700 ring-sky-200",
  LIVE: "bg-emerald-100 text-emerald-700 ring-emerald-200",
};

export function phaseIndex(phase: Phase): number {
  return PHASE_ORDER.indexOf(phase);
}

export function nextPhase(phase: Phase): Phase | null {
  return PHASE_ORDER[phaseIndex(phase) + 1] ?? null;
}

export function previousPhase(phase: Phase): Phase | null {
  const index = phaseIndex(phase);
  return index > 0 ? PHASE_ORDER[index - 1] : null;
}

import Link from "next/link";

import { sortPhases, type PhaseLike } from "@/lib/phases";

/**
 * Přepínání fází je jen odkaz — mění, kterou fázi si zobrazujete, nic neukládá.
 * Stav zakázky mění až tlačítko Ukončit fázi v seznamu úkolů.
 */
export function PhaseStepper({
  phases,
  viewedPhaseId,
  activePhaseId,
  unfinishedByPhase,
  phaseHref,
}: {
  phases: PhaseLike[];
  viewedPhaseId: string;
  activePhaseId: string | null;
  unfinishedByPhase: Record<string, number>;
  phaseHref: (phaseId: string) => string;
}) {
  return (
    <ol className="flex flex-wrap gap-1.5">
      {sortPhases(phases).map((phase) => {
        const isCompleted = phase.completedAt !== null;
        const isViewed = phase.id === viewedPhaseId;
        const isActive = phase.id === activePhaseId;
        const remaining = unfinishedByPhase[phase.id] ?? 0;

        const state = isCompleted
          ? "hotovo"
          : remaining === 0
            ? "úkoly hotové"
            : `${remaining} zbývá`;

        return (
          <li key={phase.id} className="min-w-28 flex-1">
            <Link
              href={phaseHref(phase.id)}
              aria-current={isViewed ? "step" : undefined}
              className={`block rounded-lg border px-2 py-2 transition ${
                isCompleted
                  ? isViewed
                    ? "border-emerald-600 bg-emerald-100 text-emerald-900"
                    : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                  : isViewed
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="flex items-center gap-1 text-xs font-medium">
                {isCompleted ? (
                  <svg
                    viewBox="0 0 12 12"
                    className="size-3 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                  </svg>
                ) : null}
                <span className="truncate">{phase.name}</span>
              </span>
              <span
                className={`mt-0.5 block text-[11px] ${
                  isViewed && !isCompleted ? "text-slate-300" : "opacity-70"
                }`}
              >
                {state}
                {isActive && !isCompleted ? " · aktuální" : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

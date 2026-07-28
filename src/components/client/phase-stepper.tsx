"use client";

import type { Phase } from "@prisma/client";

import { changePhase } from "@/app/actions/projects";
import { unfinishedTasksPhrase } from "@/lib/format";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";

export function PhaseStepper({
  projectId,
  currentPhase,
  unfinishedByPhase,
}: {
  projectId: string;
  currentPhase: Phase;
  unfinishedByPhase: Record<Phase, number>;
}) {
  const currentIndex = PHASE_ORDER.indexOf(currentPhase);
  const unfinishedHere = unfinishedByPhase[currentPhase] ?? 0;

  return (
    <div className="space-y-3">
      <ol className="flex flex-wrap gap-1.5">
        {PHASE_ORDER.map((phase, index) => {
          const isCurrent = phase === currentPhase;
          const isPast = index < currentIndex;
          const remaining = unfinishedByPhase[phase] ?? 0;

          const warning =
            !isCurrent && index > currentIndex && unfinishedHere > 0
              ? `Ve fázi „${PHASE_LABELS[currentPhase]}“ ${unfinishedTasksPhrase(unfinishedHere)}. Přesunout zakázku i tak?`
              : null;

          return (
            <li key={phase} className="flex-1 basis-32">
              <form
                action={changePhase}
                onSubmit={(event) => {
                  if (warning && !window.confirm(warning)) {
                    event.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="projectId" value={projectId} />
                <input type="hidden" name="phase" value={phase} />
                <button
                  type="submit"
                  disabled={isCurrent}
                  title={
                    isCurrent
                      ? "Aktuální fáze"
                      : `Přesunout do fáze ${PHASE_LABELS[phase]}`
                  }
                  className={`w-full rounded-lg border px-2 py-2 text-left transition ${
                    isCurrent
                      ? "border-slate-900 bg-slate-900 text-white"
                      : isPast
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span className="block text-xs font-medium">
                    {PHASE_LABELS[phase]}
                  </span>
                  <span
                    className={`block text-[11px] ${isCurrent ? "text-slate-300" : "text-slate-400"}`}
                  >
                    {remaining === 0 ? "hotovo" : `${remaining} zbývá`}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ol>

      {unfinishedHere > 0 ? (
        <p className="text-xs text-amber-700">
          V aktuální fázi {unfinishedTasksPhrase(unfinishedHere)}.
        </p>
      ) : null}
    </div>
  );
}

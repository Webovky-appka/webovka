"use client";

import { useState } from "react";

import { deletePhase } from "@/app/actions/projects";

/**
 * Mazání fáze bere s sebou i její úkoly, proto se potvrzuje opsáním názvu
 * zakázky i fáze. Vlastní okno, ne window.confirm — to jde v prohlížeči
 * odklikat omylem a nedá se do něj nic psát.
 */
export function DeletePhaseDialog({
  phaseId,
  phaseName,
  projectName,
  taskCount,
}: {
  phaseId: string;
  phaseName: string;
  projectName: string;
  taskCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [project, setProject] = useState("");
  const [phase, setPhase] = useState("");

  const matches =
    project.trim() === projectName.trim() && phase.trim() === phaseName.trim();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="transition hover:text-red-600"
      >
        Smazat fázi i s úkoly
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-5 shadow-lg">
        <h2 className="font-semibold text-red-900">Smazat fázi {phaseName}</h2>
        <p className="mt-2 text-sm text-slate-600">
          Smaže fázi a{" "}
          {taskCount === 0
            ? "nemá v ní žádné úkoly"
            : `${taskCount} ${taskCount === 1 ? "úkol" : taskCount < 5 ? "úkoly" : "úkolů"} v ní`}
          . Nejde vrátit. Schválení klientem zůstane zachované, protože si název
          fáze nese v sobě.
        </p>

        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-project"
              className="block text-sm font-medium text-slate-700"
            >
              Napište název zakázky
            </label>
            <input
              id="confirm-project"
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder={projectName}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="confirm-phase"
              className="block text-sm font-medium text-slate-700"
            >
              Napište název fáze
            </label>
            <input
              id="confirm-phase"
              value={phase}
              onChange={(event) => setPhase(event.target.value)}
              placeholder={phaseName}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <form action={deletePhase}>
            <input type="hidden" name="phaseId" value={phaseId} />
            <button
              type="submit"
              disabled={!matches}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Smazat fázi
            </button>
          </form>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setProject("");
              setPhase("");
            }}
            className="text-sm text-slate-600 transition hover:text-slate-900"
          >
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}

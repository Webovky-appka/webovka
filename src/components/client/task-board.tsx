import type { Phase, Task } from "@prisma/client";

import { createTask, deleteTask, toggleTask } from "@/app/actions/tasks";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";

export function TaskBoard({
  projectId,
  currentPhase,
  tasks,
}: {
  projectId: string;
  currentPhase: Phase;
  tasks: Task[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {PHASE_ORDER.map((phase) => {
        const phaseTasks = tasks
          .filter((task) => task.phase === phase)
          .sort((a, b) => a.position - b.position);
        const done = phaseTasks.filter((task) => task.done).length;

        return (
          <section
            key={phase}
            className={`flex flex-col rounded-xl border bg-white ${
              phase === currentPhase
                ? "border-slate-900 ring-1 ring-slate-900/10"
                : "border-slate-200"
            }`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
              <h3 className="text-sm font-medium text-slate-900">
                {PHASE_LABELS[phase]}
              </h3>
              <span className="text-xs tabular-nums text-slate-400">
                {done}/{phaseTasks.length}
              </span>
            </header>

            <ul className="flex-1 space-y-1 p-2">
              {phaseTasks.map((task) => (
                <li key={task.id} className="group flex items-start gap-2">
                  <form action={toggleTask} className="pt-0.5">
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      aria-label={
                        task.done
                          ? `Označit „${task.title}“ jako nehotové`
                          : `Označit „${task.title}“ jako hotové`
                      }
                      className={`flex size-4 items-center justify-center rounded border transition ${
                        task.done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-slate-300 hover:border-slate-400"
                      }`}
                    >
                      {task.done ? (
                        <svg
                          viewBox="0 0 12 12"
                          className="size-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="M2.5 6.5l2.5 2.5 4.5-5" />
                        </svg>
                      ) : null}
                    </button>
                  </form>

                  <span
                    className={`flex-1 text-sm leading-5 ${
                      task.done
                        ? "text-slate-400 line-through"
                        : "text-slate-700"
                    }`}
                  >
                    {task.title}
                  </span>

                  <form action={deleteTask}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      aria-label={`Smazat úkol ${task.title}`}
                      className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}

              {phaseTasks.length === 0 ? (
                <li className="px-1 py-2 text-xs text-slate-400">
                  Žádný úkol
                </li>
              ) : null}
            </ul>

            <form
              action={createTask}
              className="border-t border-slate-100 p-2"
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phase" value={phase} />
              <input
                name="title"
                placeholder="Přidat úkol…"
                aria-label={`Přidat úkol do fáze ${PHASE_LABELS[phase]}`}
                className="w-full rounded-lg border border-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </form>
          </section>
        );
      })}
    </div>
  );
}

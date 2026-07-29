import type { Phase, Task } from "@prisma/client";
import Link from "next/link";

import { completePhase, reopenPhase } from "@/app/actions/projects";
import { createTask, deleteTask, toggleTask } from "@/app/actions/tasks";
import { formatDayShort, isOverdue, unfinishedTasksPhrase } from "@/lib/format";
import { PHASE_LABELS } from "@/lib/phases";

/**
 * Úkoly jedné fáze. Každá fáze má vlastní seznam, takže se přidává vždy do té,
 * kterou máte na obrazovce.
 */
export function PhaseTasks({
  projectId,
  phase,
  isCompleted,
  tasks,
  taskHrefBase,
}: {
  projectId: string;
  phase: Phase;
  isCompleted: boolean;
  tasks: Task[];
  taskHrefBase: string;
}) {
  const phaseTasks = [...tasks].sort((a, b) => a.position - b.position);
  const done = phaseTasks.filter((task) => task.done).length;
  const remaining = phaseTasks.length - done;

  return (
    <section
      className={`rounded-xl border bg-white ${
        isCompleted ? "border-emerald-300" : "border-slate-200"
      }`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="font-medium text-slate-900">
            Úkoly fáze {PHASE_LABELS[phase]}
          </h2>
          <p className="text-xs text-slate-500">
            {phaseTasks.length === 0
              ? "Zatím žádný úkol"
              : `${done} z ${phaseTasks.length} hotovo`}
            {isCompleted ? " · fáze je ukončená" : ""}
          </p>
        </div>

        {isCompleted ? (
          <form action={reopenPhase}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="phase" value={phase} />
            <button
              type="submit"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-sm text-emerald-900 transition hover:bg-emerald-100"
            >
              Vrátit fázi do práce
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Upozornění je vidět jako text, ne jako potvrzovací dialog —
                nezávisí tedy na JavaScriptu a přečtete si ho před kliknutím. */}
            {remaining > 0 ? (
              <span className="text-xs text-amber-700">
                {unfinishedTasksPhrase(remaining)}
              </span>
            ) : null}
            <form action={completePhase}>
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="phase" value={phase} />
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                Ukončit fázi
              </button>
            </form>
          </div>
        )}
      </header>

      <ul className="divide-y divide-slate-50">
        {phaseTasks.map((task) => {
          const overdue = !task.done && isOverdue(task.dueDate);

          return (
            <li
              key={task.id}
              className="group flex items-start gap-3 px-4 py-2.5"
            >
              <form action={toggleTask} className="pt-0.5">
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  type="submit"
                  aria-label={
                    task.done
                      ? `Označit „${task.title}“ jako nehotové`
                      : `Označit „${task.title}“ jako hotové`
                  }
                  className={`flex size-4.5 items-center justify-center rounded border transition ${
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

              <Link href={`${taskHrefBase}&task=${task.id}`} className="flex-1">
                <span
                  className={`block text-sm ${
                    task.done
                      ? "text-slate-400 line-through"
                      : "text-slate-800 group-hover:text-slate-950"
                  }`}
                >
                  {task.title}
                </span>

                {task.description ? (
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {task.description}
                  </span>
                ) : null}

                {task.dueDate ? (
                  <span
                    className={`mt-0.5 block text-xs ${
                      overdue ? "font-medium text-red-600" : "text-slate-400"
                    }`}
                  >
                    Termín {formatDayShort(task.dueDate)}
                    {overdue ? " — po termínu" : ""}
                  </span>
                ) : null}
              </Link>

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
          );
        })}
      </ul>

      <form action={createTask} className="border-t border-slate-100 p-3">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="phase" value={phase} />
        <input
          name="title"
          placeholder={`Přidat úkol do fáze ${PHASE_LABELS[phase]}…`}
          aria-label={`Přidat úkol do fáze ${PHASE_LABELS[phase]}`}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </form>
    </section>
  );
}

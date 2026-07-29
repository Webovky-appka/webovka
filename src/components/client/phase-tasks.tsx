import Link from "next/link";

import {
  completePhase,
  renamePhase,
  reopenPhase,
  updatePhaseDueDate,
} from "@/app/actions/projects";
import { DeletePhaseDialog } from "@/components/client/delete-phase-dialog";
import { createTask, deleteTask, toggleTask } from "@/app/actions/tasks";
import {
  formatDayShort,
  formatFileSize,
  isOverdue,
  unfinishedTasksPhrase,
} from "@/lib/format";

export type PhaseTaskRow = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  done: boolean;
  position: number;
  attachments: { id: string; filename: string; size: number }[];
};

/**
 * Úkoly jedné fáze. Každá fáze má vlastní seznam, takže se přidává vždy do té,
 * kterou máte na obrazovce.
 */
export function PhaseTasks({
  phaseId,
  phaseName,
  phaseDueDate,
  projectName,
  isCompleted,
  canDeletePhase,
  tasks,
  taskHrefBase,
}: {
  phaseId: string;
  phaseName: string;
  phaseDueDate: Date | null;
  projectName: string;
  isCompleted: boolean;
  canDeletePhase: boolean;
  tasks: PhaseTaskRow[];
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
      <header className="space-y-3 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <form
            key={`rename-${phaseId}`}
            action={renamePhase}
            className="flex flex-1 items-center gap-2"
          >
            <input type="hidden" name="phaseId" value={phaseId} />
            <input
              name="name"
              defaultValue={phaseName}
              aria-label="Název fáze"
              className="min-w-40 flex-1 rounded-lg border border-transparent px-2 py-1 text-lg font-medium text-slate-900 outline-none hover:border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            />
            <button
              type="submit"
              className="shrink-0 text-xs text-slate-500 transition hover:text-slate-900"
            >
              Přejmenovat
            </button>
          </form>

          {isCompleted ? (
            <form action={reopenPhase}>
              <input type="hidden" name="phaseId" value={phaseId} />
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
                <input type="hidden" name="phaseId" value={phaseId} />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
                >
                  Ukončit fázi
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>
            {phaseTasks.length === 0
              ? "Zatím žádný úkol"
              : `${done} z ${phaseTasks.length} hotovo`}
            {isCompleted ? " · fáze je ukončená" : ""}
          </span>

          <form
            key={`due-${phaseId}`}
            action={updatePhaseDueDate}
            className="flex items-center gap-2"
          >
            <input type="hidden" name="phaseId" value={phaseId} />
            <label htmlFor={`due-${phaseId}`}>Termín fáze</label>
            <input
              id={`due-${phaseId}`}
              type="date"
              name="dueDate"
              defaultValue={
                phaseDueDate ? phaseDueDate.toISOString().slice(0, 10) : ""
              }
              className="rounded-lg border border-slate-200 px-2 py-1 outline-none focus:border-sky-500"
            />
            <button type="submit" className="transition hover:text-slate-900">
              Uložit
            </button>
          </form>

          {canDeletePhase ? (
            <div className="ml-auto">
              <DeletePhaseDialog
                phaseId={phaseId}
                phaseName={phaseName}
                projectName={projectName}
                taskCount={phaseTasks.length}
              />
            </div>
          ) : null}
        </div>
      </header>

      <ul className="divide-y divide-slate-100">
        {phaseTasks.map((task) => {
          const overdue = !task.done && isOverdue(task.dueDate);

          return (
            <li key={task.id} className="group px-5 py-3.5">
              <div className="flex items-start gap-3">
                <form action={toggleTask} className="pt-0.5">
                  <input type="hidden" name="taskId" value={task.id} />
                  <button
                    type="submit"
                    aria-label={
                      task.done
                        ? `Označit „${task.title}“ jako nehotové`
                        : `Označit „${task.title}“ jako hotové`
                    }
                    className={`flex size-5 items-center justify-center rounded border transition ${
                      task.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 hover:border-slate-400"
                    }`}
                  >
                    {task.done ? (
                      <svg
                        viewBox="0 0 12 12"
                        className="size-3.5"
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

                <div className="min-w-0 flex-1">
                  <Link href={`${taskHrefBase}&task=${task.id}#task-editor`}>
                    <span
                      className={`block ${
                        task.done
                          ? "text-slate-400 line-through"
                          : "text-slate-900 group-hover:underline"
                      }`}
                    >
                      {task.title}
                    </span>
                  </Link>

                  {task.description ? (
                    <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
                      {task.description}
                    </p>
                  ) : null}

                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs">
                    {task.dueDate ? (
                      <span
                        className={
                          overdue
                            ? "font-medium text-red-600"
                            : "text-slate-400"
                        }
                      >
                        Termín {formatDayShort(task.dueDate)}
                        {overdue ? " — po termínu" : ""}
                      </span>
                    ) : null}

                    {task.attachments.map((file) => (
                      <a
                        key={file.id}
                        href={`/api/attachments/${file.id}`}
                        className="text-sky-700 underline hover:text-sky-900"
                      >
                        {file.filename}{" "}
                        <span className="text-slate-400 no-underline">
                          {formatFileSize(file.size)}
                        </span>
                      </a>
                    ))}

                    <Link
                      href={`${taskHrefBase}&task=${task.id}#task-editor`}
                      className="text-slate-500 transition hover:text-slate-900"
                    >
                      Upravit a přidat soubor
                    </Link>
                  </div>
                </div>

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
              </div>
            </li>
          );
        })}
      </ul>

      <form action={createTask} className="border-t border-slate-100 p-4">
        <input type="hidden" name="phaseId" value={phaseId} />
        <input
          name="title"
          placeholder={`Přidat úkol do fáze ${phaseName}…`}
          aria-label={`Přidat úkol do fáze ${phaseName}`}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
      </form>
    </section>
  );
}

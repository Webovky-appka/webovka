import type { Phase, TaskTemplate } from "@prisma/client";

import {
  createTaskTemplate,
  deleteTaskTemplate,
} from "@/app/actions/task-templates";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";

export function TaskTemplatePanel({
  templates,
}: {
  templates: TaskTemplate[];
}) {
  const byPhase = new Map<Phase, TaskTemplate[]>(
    PHASE_ORDER.map((phase) => [
      phase,
      templates
        .filter((template) => template.phase === phase)
        .sort((a, b) => a.position - b.position),
    ]),
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Z těchto úkolů se předvyplní nástěnka každé nově založené zakázky.
        Úpravy se nepropisují do zakázek, které už existují.
      </p>

      <div className="grid gap-3 lg:grid-cols-5">
        {PHASE_ORDER.map((phase) => {
          const items = byPhase.get(phase) ?? [];

          return (
            <section
              key={phase}
              className="flex flex-col rounded-xl border border-slate-200 bg-white"
            >
              <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <h3 className="text-sm font-medium text-slate-900">
                  {PHASE_LABELS[phase]}
                </h3>
                <span className="text-xs tabular-nums text-slate-400">
                  {items.length}
                </span>
              </header>

              <ul className="flex-1 space-y-1 p-2">
                {items.map((template) => (
                  <li
                    key={template.id}
                    className="group flex items-start gap-2"
                  >
                    <span className="flex-1 text-sm leading-5 text-slate-700">
                      {template.title}
                    </span>
                    <form action={deleteTaskTemplate}>
                      <input
                        type="hidden"
                        name="templateId"
                        value={template.id}
                      />
                      <button
                        type="submit"
                        aria-label={`Odebrat ze šablony: ${template.title}`}
                        className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))}

                {items.length === 0 ? (
                  <li className="px-1 py-2 text-xs text-slate-400">
                    Žádný úkol
                  </li>
                ) : null}
              </ul>

              <form
                action={createTaskTemplate}
                className="border-t border-slate-100 p-2"
              >
                <input type="hidden" name="phase" value={phase} />
                <input
                  name="title"
                  placeholder="Přidat do šablony…"
                  aria-label={`Přidat do šablony fáze ${PHASE_LABELS[phase]}`}
                  className="w-full rounded-lg border border-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
              </form>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import {
  createPhaseTemplate,
  createTaskTemplate,
  deletePhaseTemplate,
  deleteTaskTemplate,
  renamePhaseTemplate,
} from "@/app/actions/task-templates";

export type PhaseTemplateRow = {
  id: string;
  name: string;
  position: number;
  tasks: { id: string; title: string; position: number }[];
};

export function TaskTemplatePanel({
  templates,
}: {
  templates: PhaseTemplateRow[];
}) {
  const ordered = [...templates].sort((a, b) => a.position - b.position);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Takhle bude vypadat každá nově založená zakázka — tyto fáze a v nich tyto
        úkoly. U konkrétní zakázky si pak fáze přidáte, přejmenujete nebo
        smažete; úpravy předlohy se do rozjetých zakázek nepropisují.
      </p>

      <div className="space-y-3">
        {ordered.map((template) => (
          <section
            key={template.id}
            className="rounded-xl border border-slate-200 bg-white"
          >
            <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2">
              <form
                action={renamePhaseTemplate}
                className="flex flex-1 items-center gap-2"
              >
                <input type="hidden" name="templateId" value={template.id} />
                <input
                  name="name"
                  defaultValue={template.name}
                  aria-label="Název fáze v předloze"
                  className="min-w-32 flex-1 rounded-lg border border-transparent px-2 py-1 text-sm font-medium text-slate-900 outline-none hover:border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  className="shrink-0 text-xs text-slate-500 transition hover:text-slate-900"
                >
                  Přejmenovat
                </button>
              </form>

              <form action={deletePhaseTemplate}>
                <input type="hidden" name="templateId" value={template.id} />
                <button
                  type="submit"
                  aria-label={`Odebrat fázi ${template.name} z předlohy`}
                  className="text-slate-300 transition hover:text-red-600"
                >
                  ×
                </button>
              </form>
            </header>

            <ul className="space-y-1 p-2">
              {[...template.tasks]
                .sort((a, b) => a.position - b.position)
                .map((task) => (
                  <li key={task.id} className="group flex items-start gap-2">
                    <span className="flex-1 text-sm text-slate-700">
                      {task.title}
                    </span>
                    <form action={deleteTaskTemplate}>
                      <input type="hidden" name="templateId" value={task.id} />
                      <button
                        type="submit"
                        aria-label={`Odebrat úkol ${task.title} z předlohy`}
                        className="text-slate-300 opacity-0 transition group-hover:opacity-100 hover:text-red-600"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))}

              {template.tasks.length === 0 ? (
                <li className="px-1 py-1.5 text-xs text-slate-400">
                  Bez úkolů
                </li>
              ) : null}
            </ul>

            <form
              action={createTaskTemplate}
              className="border-t border-slate-100 p-2"
            >
              <input
                type="hidden"
                name="phaseTemplateId"
                value={template.id}
              />
              <input
                name="title"
                placeholder="Přidat úkol do předlohy…"
                aria-label={`Přidat úkol do fáze ${template.name}`}
                className="w-full rounded-lg border border-transparent px-2 py-1.5 text-sm outline-none placeholder:text-slate-400 hover:border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
            </form>
          </section>
        ))}
      </div>

      <form action={createPhaseTemplate} className="flex gap-2">
        <input
          name="name"
          placeholder="Přidat fázi do předlohy…"
          aria-label="Přidat fázi do předlohy"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <button
          type="submit"
          className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Přidat fázi
        </button>
      </form>
    </div>
  );
}

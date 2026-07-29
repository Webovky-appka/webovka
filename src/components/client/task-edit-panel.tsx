"use client";

import type { Phase, Task } from "@prisma/client";
import Link from "next/link";
import { useActionState } from "react";

import { updateTask, type TaskFormState } from "@/app/actions/tasks";
import { Field, FormError, TextareaField } from "@/components/field";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";

export function TaskEditPanel({
  task,
  closeHref,
}: {
  task: Pick<Task, "id" | "title" | "description" | "dueDate" | "phase">;
  closeHref: string;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    updateTask,
    undefined,
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-900 bg-white p-5 ring-1 ring-slate-900/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Úprava úkolu</h2>
        <Link
          href={closeHref}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          Zavřít
        </Link>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="taskId" value={task.id} />

        <Field label="Název" name="title" defaultValue={task.title} required />

        <TextareaField
          label="Popis"
          name="description"
          defaultValue={task.description}
          rows={3}
          hint="Podrobnosti, které se nevejdou do názvu. Klient je nevidí."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Termín"
            name="dueDate"
            type="date"
            defaultValue={
              task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""
            }
          />

          <div className="space-y-1.5">
            <label
              htmlFor="phase"
              className="block text-sm font-medium text-slate-700"
            >
              Fáze
            </label>
            <select
              id="phase"
              name="phase"
              defaultValue={task.phase}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {PHASE_ORDER.map((phase: Phase) => (
                <option key={phase} value={phase}>
                  {PHASE_LABELS[phase]}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Změnou fáze se úkol přesune do jiného sloupce.
            </p>
          </div>
        </div>

        <FormError message={state?.error} />

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Uložit úkol"}
        </button>
      </form>
    </section>
  );
}

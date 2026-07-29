"use client";

import { AttachmentKind } from "@prisma/client";
import Link from "next/link";
import { useActionState, useRef } from "react";

import {
  deleteAttachment,
  uploadAttachment,
  type AttachmentState,
} from "@/app/actions/attachments";
import { updateTask, type TaskFormState } from "@/app/actions/tasks";
import { Field, FormError, TextareaField } from "@/components/field";
import { formatFileSize } from "@/lib/format";

export type EditedTask = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  phaseId: string;
  attachments: { id: string; filename: string; size: number }[];
};

export function TaskEditPanel({
  task,
  clientId,
  projectId,
  projectName,
  phases,
  closeHref,
}: {
  task: EditedTask;
  clientId: string;
  projectId: string;
  projectName: string;
  phases: { id: string; name: string }[];
  closeHref: string;
}) {
  const [state, formAction, pending] = useActionState<TaskFormState, FormData>(
    updateTask,
    undefined,
  );

  return (
    <section className="space-y-5 rounded-xl border border-slate-900 bg-white p-5 ring-1 ring-slate-900/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Úprava úkolu — {projectName}
        </h2>
        <Link
          href={closeHref}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          Zavřít
        </Link>
      </div>

      <form id="task-fields" action={formAction} className="space-y-4">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="closeHref" value={closeHref} />

        <Field label="Název" name="title" defaultValue={task.title} required />

        <TextareaField
          label="Popis"
          name="description"
          defaultValue={task.description}
          rows={6}
          hint="Prostor na podrobnosti — co je potřeba, na co nezapomenout. Klient to nevidí."
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
              htmlFor="phaseId"
              className="block text-sm font-medium text-slate-700"
            >
              Fáze
            </label>
            <select
              id="phaseId"
              name="phaseId"
              defaultValue={task.phaseId}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
            >
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Změnou fáze se úkol přesune jinam.
            </p>
          </div>
        </div>

        <FormError message={state?.error} />
      </form>

      <hr className="border-slate-100" />

      <TaskFiles
        taskId={task.id}
        clientId={clientId}
        projectId={projectId}
        files={task.attachments}
      />

      <hr className="border-slate-100" />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          form="task-fields"
          disabled={pending}
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ukládám…" : "Uložit úkol"}
        </button>
        <span className="text-xs text-slate-500">
          Uložením se panel zavře. Nahrané soubory se ukládají hned.
        </span>
      </div>
    </section>
  );
}

function TaskFiles({
  taskId,
  clientId,
  projectId,
  files,
}: {
  taskId: string;
  clientId: string;
  projectId: string;
  files: { id: string; filename: string; size: number }[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    AttachmentState,
    FormData
  >(async (prevState, formData) => {
    const result = await uploadAttachment(prevState, formData);
    if (!result?.error) formRef.current?.reset();
    return result;
  }, undefined);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-900">Soubory u úkolu</h3>

      {files.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2">
              <a
                href={`/api/attachments/${file.id}`}
                className="truncate text-sky-700 underline hover:text-sky-900"
              >
                {file.filename}
              </a>
              <span className="shrink-0 text-xs text-slate-400">
                {formatFileSize(file.size)}
              </span>
              <form action={deleteAttachment}>
                <input type="hidden" name="attachmentId" value={file.id} />
                <button
                  type="submit"
                  aria-label={`Smazat soubor ${file.filename}`}
                  className="text-slate-300 transition hover:text-red-600"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Zatím žádný soubor.</p>
      )}

      <form ref={formRef} action={formAction} className="space-y-2">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="taskId" value={taskId} />
        {/* Soubory u úkolu jsou pracovní podklady, ne smlouvy. */}
        <input type="hidden" name="kind" value={AttachmentKind.OTHER} />

        <div className="flex flex-wrap items-center gap-2">
          <input
            name="file"
            type="file"
            required
            aria-label="Soubor k úkolu"
            className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {pending ? "Nahrávám…" : "Nahrát"}
          </button>
        </div>

        <FormError message={state?.error} />
        <p className="text-xs text-slate-500">
          Fotka, screenshot nebo podklad. Nejvýše 25 MB.
        </p>
      </form>
    </div>
  );
}

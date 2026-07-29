"use client";

import { AttachmentKind } from "@prisma/client";
import { useActionState, useRef } from "react";

import {
  deleteAttachment,
  toggleAttachmentVisibility,
  uploadAttachment,
  type AttachmentState,
} from "@/app/actions/attachments";
import { FormError } from "@/components/field";
import { formatDate, formatFileSize } from "@/lib/format";

const KIND_LABELS: Record<AttachmentKind, string> = {
  CONTRACT: "Smlouva",
  LOGO: "Logo",
  INVOICE: "Faktura",
  SCREENSHOT: "Screenshot",
  OTHER: "Jiné",
};

export type FileRow = {
  id: string;
  filename: string;
  kind: AttachmentKind;
  size: number;
  visibleInPortal: boolean;
  createdAt: Date;
  uploadedBy: { name: string } | null;
};

export function FilesPanel({
  clientId,
  projectId,
  files,
}: {
  clientId: string;
  projectId: string;
  files: FileRow[];
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
    <div className="space-y-4">
      <form
        ref={formRef}
        action={formAction}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="projectId" value={projectId} />

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1 space-y-1.5">
            <label
              htmlFor="file"
              className="block text-sm font-medium text-slate-700"
            >
              Soubor
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="kind"
              className="block text-sm font-medium text-slate-700"
            >
              Typ
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={AttachmentKind.OTHER}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
            >
              {Object.values(AttachmentKind).map((value) => (
                <option key={value} value={value}>
                  {KIND_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {pending ? "Nahrávám…" : "Nahrát"}
          </button>
        </div>

        <FormError message={state?.error} />
        <p className="text-xs text-slate-500">
          Nejvýše 25 MB. Obrázky, PDF, ZIP, dokumenty Wordu a Excelu.
        </p>
      </form>

      {files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
          <p className="font-medium text-slate-900">Zatím žádný soubor</p>
          <p className="mt-1 text-sm text-slate-500">
            Smlouvy, loga, faktury a screenshoty schválených verzí.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {files.map((file) => (
            <li
              key={file.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <a
                  href={`/api/attachments/${file.id}`}
                  className="block truncate text-sm font-medium text-slate-900 hover:text-sky-700 hover:underline"
                >
                  {file.filename}
                </a>
                <p className="text-xs text-slate-500">
                  {KIND_LABELS[file.kind]} · {formatFileSize(file.size)} ·{" "}
                  {formatDate(file.createdAt)}
                  {file.uploadedBy ? ` · ${file.uploadedBy.name}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <form action={toggleAttachmentVisibility}>
                  <input type="hidden" name="attachmentId" value={file.id} />
                  <button
                    type="submit"
                    className={`rounded-full px-2 py-1 transition ${
                      file.visibleInPortal
                        ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    {file.visibleInPortal
                      ? "Vidí klient"
                      : "Zpřístupnit klientovi"}
                  </button>
                </form>

                <form action={deleteAttachment}>
                  <input type="hidden" name="attachmentId" value={file.id} />
                  <button
                    type="submit"
                    className="text-slate-400 transition hover:text-red-600"
                  >
                    Smazat
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

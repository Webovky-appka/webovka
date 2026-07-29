"use client";

import { ClientStatus, ProjectStatus } from "@prisma/client";

import { setClientStatus } from "@/app/actions/clients";
import { setProjectStatus } from "@/app/actions/projects";
import { AutoSubmitSelect, SaveIndicator } from "@/components/auto-save";

const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Poptávka",
  ACTIVE: "Aktivní",
  DONE: "Dokončeno",
  ARCHIVED: "Archiv",
};

const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTIVE: "Aktivní",
  DONE: "Dokončená",
  ARCHIVED: "Archivovaná",
};

const selectClasses =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

function toOptions<T extends string>(labels: Record<T, string>) {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

export function ClientStatusField({
  clientId,
  status,
}: {
  clientId: string;
  status: ClientStatus;
}) {
  return (
    <form action={setClientStatus} className="flex items-center gap-2">
      <input type="hidden" name="clientId" value={clientId} />
      <AutoSubmitSelect
        name="status"
        defaultValue={status}
        ariaLabel="Stav klienta"
        className={`${selectClasses} w-56`}
        options={toOptions(CLIENT_STATUS_LABELS)}
      />
      <SaveIndicator />
    </form>
  );
}

export function ProjectStatusField({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  return (
    <form action={setProjectStatus} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <AutoSubmitSelect
        name="status"
        defaultValue={status}
        ariaLabel="Stav zakázky"
        className={selectClasses}
        options={toOptions(PROJECT_STATUS_LABELS)}
      />
      <SaveIndicator />
    </form>
  );
}

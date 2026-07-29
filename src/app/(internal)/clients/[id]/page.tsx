import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorType, Phase, ProjectStatus } from "@prisma/client";

import { setProjectStatus } from "@/app/actions/projects";
import { ClientDetailForm } from "@/components/client/client-detail-form";
import { DeleteClientPanel } from "@/components/client/delete-client-panel";
import { FilesPanel } from "@/components/client/files-panel";
import { MessageEditPanel } from "@/components/client/message-edit-panel";
import { MessageForm } from "@/components/client/message-form";
import { NewProjectForm } from "@/components/client/new-project-form";
import { PhaseStepper } from "@/components/client/phase-stepper";
import { PhaseTasks } from "@/components/client/phase-tasks";
import { PortalLinkPanel } from "@/components/client/portal-link-panel";
import { ProjectPortalForm } from "@/components/client/project-portal-form";
import { TaskEditPanel } from "@/components/client/task-edit-panel";
import { Timeline } from "@/components/client/timeline";
import { PhaseBadge } from "@/components/phase-badge";
import { ProgressBar } from "@/components/progress-bar";
import { requireUser } from "@/lib/auth";
import { formatDay } from "@/lib/format";
import { PHASE_ORDER, activePhase } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

const TABS = [
  { key: "tasks", label: "Úkoly" },
  { key: "communication", label: "Komunikace" },
  { key: "files", label: "Soubory" },
  { key: "settings", label: "Nastavení" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const client = await prisma.client.findUnique({
    where: { id },
    select: { companyName: true },
  });

  return {
    title: client
      ? `${client.companyName} — Stavba webu`
      : "Klient — Stavba webu",
  };
}

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    project?: string;
    tab?: string;
    task?: string;
    message?: string;
    phase?: string;
  }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;
  const {
    project: projectParam,
    tab: tabParam,
    task: taskParam,
    message: messageParam,
    phase: phaseParam,
  } = await props.searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          phase: true,
          status: true,
          portalNote: true,
          previewUrl: true,
          dueDate: true,
        },
      },
    },
  });

  if (!client) notFound();

  const activeTab: TabKey = TABS.find((tab) => tab.key === tabParam)?.key ?? "tasks";

  const selectedProject =
    client.projects.find((p) => p.id === projectParam) ?? client.projects[0];

  const [tasks, messages, approvals, portalLink, files, completions] =
    selectedProject
      ? await Promise.all([
          prisma.task.findMany({ where: { projectId: selectedProject.id } }),
          prisma.message.findMany({
            where: { clientId: client.id },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              author: { select: { name: true } },
              project: { select: { name: true } },
            },
          }),
          prisma.approval.findMany({
            where: { projectId: selectedProject.id },
            orderBy: { createdAt: "desc" },
          }),
          prisma.portalLink.findFirst({
            where: { projectId: selectedProject.id, active: true },
            orderBy: { createdAt: "desc" },
          }),
          prisma.attachment.findMany({
            where: { clientId: client.id },
            orderBy: { createdAt: "desc" },
            include: {
              uploadedBy: { select: { name: true } },
              project: { select: { id: true, name: true } },
            },
          }),
          prisma.phaseCompletion.findMany({
            where: { projectId: selectedProject.id },
            select: { phase: true },
          }),
        ])
      : [[], [], [], null, [], []];

  const completedPhases = completions.map((completion) => completion.phase);
  const currentPhase = activePhase(completedPhases);

  // Zobrazená fáze je jen věc URL — nepřepíná stav zakázky, jen co je vidět.
  const viewedPhase =
    PHASE_ORDER.find((phase) => phase === phaseParam) ?? currentPhase;

  const unfinishedByPhase = PHASE_ORDER.reduce(
    (acc, phase) => {
      acc[phase] = tasks.filter(
        (task) => task.phase === phase && !task.done,
      ).length;
      return acc;
    },
    {} as Record<Phase, number>,
  );

  const doneCount = tasks.filter((task) => task.done).length;

  function buildHref(overrides: {
    tab?: TabKey;
    phase?: Phase;
    task?: string;
    message?: string;
  }) {
    const params = new URLSearchParams();
    if (selectedProject) params.set("project", selectedProject.id);
    params.set("tab", overrides.tab ?? activeTab);
    params.set("phase", overrides.phase ?? viewedPhase);
    if (overrides.task) params.set("task", overrides.task);
    if (overrides.message) params.set("message", overrides.message);
    return `/clients/${client!.id}?${params.toString()}`;
  }

  const editedTask = taskParam
    ? (tasks.find((task) => task.id === taskParam) ?? null)
    : null;
  const editedMessage = messageParam
    ? (messages.find(
        (message) =>
          message.id === messageParam &&
          message.authorType === AuthorType.USER &&
          message.authorId === user.id,
      ) ?? null)
    : null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/projects"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Zakázky
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {client.companyName}
            </h1>
            <p className="text-sm text-slate-500">
              {[client.contactPerson, client.email, client.phone]
                .filter(Boolean)
                .join(" · ") || "Bez kontaktních údajů"}
            </p>
          </div>
          {selectedProject ? <PhaseBadge phase={currentPhase} /> : null}
        </div>
      </div>

      {client.projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10">
          <p className="text-center font-medium text-slate-900">
            Klient nemá žádnou zakázku
          </p>
          <div className="mx-auto mt-4 max-w-sm">
            <NewProjectForm clientId={client.id} />
          </div>
        </div>
      ) : null}

      {selectedProject ? (
        <>
          {client.projects.length > 1 ? (
            <nav className="flex flex-wrap gap-1.5">
              {client.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/clients/${client.id}?project=${project.id}&tab=${activeTab}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                    project.id === selectedProject.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  {project.name}
                </Link>
              ))}
            </nav>
          ) : null}

          {/* Kontakt a portál jsou hned na začátku, ať je vidět všechno podstatné. */}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Klient</h2>
              <ClientDetailForm client={client} />
            </section>

            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Klientský portál
              </h2>
              <ProjectPortalForm
                projectId={selectedProject.id}
                portalNote={selectedProject.portalNote}
                previewUrl={selectedProject.previewUrl}
                dueDate={selectedProject.dueDate}
              />
              <hr className="border-slate-100" />
              <PortalLinkPanel
                projectId={selectedProject.id}
                previewHref={`/clients/${client.id}/preview?project=${selectedProject.id}`}
                portalLink={
                  portalLink
                    ? {
                        id: portalLink.id,
                        expiresAt: portalLink.expiresAt,
                        lastVisitedAt: portalLink.lastVisitedAt,
                        createdAt: portalLink.createdAt,
                      }
                    : null
                }
                approvals={approvals.map((approval) => ({
                  id: approval.id,
                  phase: approval.phase,
                  createdAt: approval.createdAt,
                  ipAddress: approval.ipAddress,
                  snapshotNote: approval.snapshotNote,
                  snapshotPreviewUrl: approval.snapshotPreviewUrl,
                }))}
              />
            </section>
          </div>

          <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-medium text-slate-900">
                  {selectedProject.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedProject.dueDate
                    ? `Termín fáze: ${formatDay(selectedProject.dueDate)}`
                    : "Bez termínu"}
                  {selectedProject.status !== ProjectStatus.ACTIVE
                    ? ` · ${selectedProject.status === ProjectStatus.DONE ? "dokončená" : "archivovaná"}`
                    : ""}
                </p>
              </div>
              <ProgressBar
                done={doneCount}
                total={tasks.length}
                className="w-48"
              />
            </div>

            <PhaseStepper
              viewedPhase={viewedPhase}
              activePhase={currentPhase}
              completedPhases={completedPhases}
              unfinishedByPhase={unfinishedByPhase}
              phaseHref={(phase) => buildHref({ tab: "tasks", phase })}
            />
          </section>

          <nav className="flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={buildHref({ tab: tab.key })}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  tab.key === activeTab
                    ? "border-slate-900 font-medium text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-900"
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          {activeTab === "tasks" ? (
            <div className="space-y-4">
              {editedTask ? (
                <TaskEditPanel task={editedTask} closeHref={buildHref({})} />
              ) : null}
              <PhaseTasks
                projectId={selectedProject.id}
                phase={viewedPhase}
                isCompleted={completedPhases.includes(viewedPhase)}
                tasks={tasks.filter((task) => task.phase === viewedPhase)}
                taskHrefBase={buildHref({})}
              />
            </div>
          ) : null}

          {activeTab === "communication" ? (
            <div className="space-y-4">
              {editedMessage ? (
                <MessageEditPanel
                  message={editedMessage}
                  closeHref={buildHref({})}
                />
              ) : (
                <MessageForm
                  clientId={client.id}
                  projectId={selectedProject.id}
                />
              )}
              <Timeline
                messages={messages}
                currentUserId={user.id}
                editHrefBase={buildHref({})}
              />
            </div>
          ) : null}

          {activeTab === "files" ? (
            <FilesPanel
              clientId={client.id}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
              files={files}
            />
          ) : null}

          {activeTab === "settings" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Zakázky
                </h2>
                <NewProjectForm clientId={client.id} />

                <ul className="space-y-2 text-sm">
                  {client.projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="truncate text-slate-700">
                        {project.name}
                      </span>
                      <form action={setProjectStatus}>
                        <input
                          type="hidden"
                          name="projectId"
                          value={project.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value={
                            project.status === ProjectStatus.ACTIVE
                              ? ProjectStatus.DONE
                              : ProjectStatus.ACTIVE
                          }
                        />
                        <button
                          type="submit"
                          className="shrink-0 text-xs text-slate-500 transition hover:text-slate-900"
                        >
                          {project.status === ProjectStatus.ACTIVE
                            ? "Označit dokončenou"
                            : "Vrátit do aktivních"}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>

              <DeleteClientPanel
                clientId={client.id}
                companyName={client.companyName}
                attachmentCount={files.length}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

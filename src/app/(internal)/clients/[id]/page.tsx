import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorType } from "@prisma/client";

import { createPhase } from "@/app/actions/projects";
import { ClientDetailForm } from "@/components/client/client-detail-form";
import { DeleteClientPanel } from "@/components/client/delete-client-panel";
import { DocsPanel } from "@/components/client/docs-panel";
import { EmailComposer } from "@/components/client/email-composer";
import { FilesPanel } from "@/components/client/files-panel";
import { GithubPanel } from "@/components/client/github-panel";
import { MessageEditPanel } from "@/components/client/message-edit-panel";
import { MessageForm } from "@/components/client/message-form";
import { NewProjectForm } from "@/components/client/new-project-form";
import { PhaseStepper } from "@/components/client/phase-stepper";
import { PhaseTasks } from "@/components/client/phase-tasks";
import { PortalLinkPanel } from "@/components/client/portal-link-panel";
import { ProjectPortalForm } from "@/components/client/project-portal-form";
import {
  ClientStatusField,
  ProjectStatusField,
} from "@/components/client/status-panel";
import { TaskEditPanel } from "@/components/client/task-edit-panel";
import { Timeline } from "@/components/client/timeline";
import { PhaseBadge } from "@/components/phase-badge";
import { SiteEmbed } from "@/components/site-embed";
import { ProgressBar } from "@/components/progress-bar";
import { aiModel, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { DOC_TEMPLATES } from "@/lib/doc-templates";
import { googleAccountFor, hasDocsAccess, isGoogleConfigured } from "@/lib/google";
import { activePhase, sortPhases } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

const TABS = [
  { key: "messages", label: "Komunikace" },
  { key: "docs", label: "Dokumenty" },
  { key: "email", label: "Napsat e-mail" },
  { key: "github", label: "GitHub" },
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
      ? `${client.companyName} — Mitsov Web`
      : "Klient — Mitsov Web",
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
          status: true,
          portalNote: true,
          previewUrl: true,
          repoFullName: true,
        },
      },
    },
  });

  if (!client) notFound();

  // Komunikace je výchozí složka — otevře se sama, ale jde z ní přepnout.
  const activeTab = TABS.find((tab) => tab.key === tabParam)?.key ?? "messages";
  const selectedProject =
    client.projects.find((p) => p.id === projectParam) ?? client.projects[0];

  const [phases, tasks, messages, approvals, portalLink, files] =
    selectedProject
      ? await Promise.all([
          prisma.projectPhase.findMany({
            where: { projectId: selectedProject.id },
            orderBy: { position: "asc" },
          }),
          prisma.task.findMany({
            where: { projectId: selectedProject.id },
            include: {
              attachments: {
                orderBy: { createdAt: "asc" },
                select: { id: true, filename: true, size: true },
              },
            },
          }),
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
        ])
      : [[], [], [], [], null, []];

  // Napojení na Gmail je potřeba jen v záložce s e-mailem, jinak se pro nic
  // netaháme do databáze.
  const gmailAccount =
    activeTab === "email" ? await googleAccountFor(user.id) : null;

  // Totéž pro dokumenty — napojení účtu a seznam dokumentů řeší jen svoje záložka.
  const [docsAccount, projectDocs] =
    activeTab === "docs" && selectedProject
      ? await Promise.all([
          googleAccountFor(user.id),
          prisma.projectDoc.findMany({
            where: { projectId: selectedProject.id },
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              webViewLink: true,
              createdAt: true,
              createdBy: { select: { name: true } },
            },
          }),
        ])
      : [null, []];

  const ordered = sortPhases(phases);
  const current = activePhase(ordered);

  // Zobrazená fáze je jen věc URL — nepřepíná stav zakázky, jen co je vidět.
  const viewedPhase =
    ordered.find((phase) => phase.id === phaseParam) ?? current;

  const unfinishedByPhase = Object.fromEntries(
    ordered.map((phase) => [
      phase.id,
      tasks.filter((task) => task.phaseId === phase.id && !task.done).length,
    ]),
  );

  // Progres ukazuje hotové fáze — posune se, až fázi ukončíte, ne po každém úkolu.
  const donePhases = ordered.filter((phase) => phase.completedAt !== null).length;

  function buildHref(overrides: {
    tab?: TabKey | null;
    phase?: string;
    task?: string;
    message?: string;
  }) {
    const params = new URLSearchParams();
    if (selectedProject) params.set("project", selectedProject.id);
    const tab = overrides.tab === undefined ? activeTab : overrides.tab;
    if (tab) params.set("tab", tab);
    const phase = overrides.phase ?? viewedPhase?.id;
    if (phase) params.set("phase", phase);
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
          {current ? <PhaseBadge name={current.name} /> : null}
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
                  scroll={false}
                  href={`/clients/${client.id}?project=${project.id}`}
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

          {/* Úkoly jsou první — kvůli nim se zakázka otevírá. */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-medium text-slate-900">
                {selectedProject.name}
              </h2>
              <ProgressBar
                done={donePhases}
                total={ordered.length}
                label={`${donePhases} z ${ordered.length} fází hotovo`}
                className="w-56"
              />
            </div>

            <PhaseStepper
              phases={ordered}
              viewedPhaseId={viewedPhase?.id ?? ""}
              activePhaseId={current?.id ?? null}
              unfinishedByPhase={unfinishedByPhase}
              phaseHref={(phaseId) => buildHref({ phase: phaseId })}
            />

            <form action={createPhase} className="flex gap-2">
              <input
                type="hidden"
                name="projectId"
                value={selectedProject.id}
              />
              <input
                name="name"
                placeholder="Přidat fázi…"
                aria-label="Přidat fázi k zakázce"
                className="max-w-64 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
              />
              <button
                type="submit"
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Přidat fázi
              </button>
            </form>

            {viewedPhase ? (
              <PhaseTasks
                phaseId={viewedPhase.id}
                phaseName={viewedPhase.name}
                phaseDueDate={viewedPhase.dueDate}
                projectName={selectedProject.name}
                isCompleted={viewedPhase.completedAt !== null}
                canDeletePhase={ordered.length > 1}
                tasks={tasks.filter((task) => task.phaseId === viewedPhase.id)}
                taskHrefBase={buildHref({})}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
                Zakázka nemá žádnou fázi. Přidejte první a můžete zadávat úkoly.
              </p>
            )}

            {editedTask ? (
              <div id="task-editor">
                <TaskEditPanel
                  task={editedTask}
                  clientId={client.id}
                  projectId={selectedProject.id}
                  projectName={selectedProject.name}
                  phases={ordered.map((phase) => ({
                    id: phase.id,
                    name: phase.name,
                  }))}
                  closeHref={buildHref({})}
                />
              </div>
            ) : null}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-900">Klient</h2>
              {client.website ? (
                <SiteEmbed url={client.website} title="Stávající web klienta" />
              ) : null}
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
                  phaseName: approval.phaseName,
                  createdAt: approval.createdAt,
                  ipAddress: approval.ipAddress,
                  snapshotNote: approval.snapshotNote,
                  snapshotPreviewUrl: approval.snapshotPreviewUrl,
                }))}
              />
            </section>
          </div>

          <nav className="flex gap-1 border-b border-slate-200">
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                scroll={false}
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

          {activeTab === "docs" ? (
            <DocsPanel
              projectId={selectedProject.id}
              templates={DOC_TEMPLATES}
              docs={projectDocs}
              googleEmail={docsAccount?.email ?? null}
              docsAllowed={hasDocsAccess(docsAccount?.scope)}
              googleConfigured={isGoogleConfigured()}
            />
          ) : null}

          {activeTab === "files" ? (
            <FilesPanel
              clientId={client.id}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
              files={files}
            />
          ) : null}

          {activeTab === "github" ? (
            <GithubPanel
              projectId={selectedProject.id}
              repoFullName={selectedProject.repoFullName}
            />
          ) : null}

          {activeTab === "settings" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-slate-900">
                  Zakázky
                </h2>

                {/* Stavy se ukládají hned po přepnutí, tlačítko Uložit tu není. */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-700">
                    Stav klienta
                  </p>
                  <ClientStatusField
                    clientId={client.id}
                    status={client.status}
                  />
                  <p className="text-xs text-slate-500">
                    Archiv klienta skryje z přehledů, data zůstanou zachovaná.
                  </p>
                </div>

                <hr className="border-slate-100" />

                <NewProjectForm clientId={client.id} />

                <ul className="space-y-2 text-sm">
                  {client.projects.map((project) => (
                    <li
                      key={project.id}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="truncate text-slate-700">
                        {project.name}
                      </span>
                      <ProjectStatusField
                        projectId={project.id}
                        status={project.status}
                      />
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

          {activeTab === "email" ? (
            <EmailComposer
              projectId={selectedProject.id}
              projectName={selectedProject.name}
              clientEmail={client.email}
              gmailAddress={gmailAccount?.email ?? null}
              aiReady={isAiConfigured()}
              aiModel={aiModel()}
            />
          ) : null}

          {activeTab === "messages" ? (
            <section className="space-y-4">
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
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

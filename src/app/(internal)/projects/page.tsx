import Link from "next/link";
import { ProjectStatus, type Prisma } from "@prisma/client";

import { PhaseBadge } from "@/components/phase-badge";
import { ProgressBar } from "@/components/progress-bar";
import { ProjectFilter } from "@/components/project-filter";
import { requireUser } from "@/lib/auth";
import {
  formatRelativeDays,
  isContactStale,
  pluralCs,
  unfinishedTasksPhrase,
} from "@/lib/format";
import { activePhase, sortPhases } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Zakázky — Mitsov Web",
};

type SearchParams = {
  q?: string;
  status?: string;
};

export default async function ProjectsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const { q, status } = await props.searchParams;

  // Archivované zakázky se ukazují jen na výslovné vyžádání.
  const statusFilter =
    status === "all"
      ? undefined
      : status === "archived"
        ? ProjectStatus.ARCHIVED
        : status === "done"
          ? ProjectStatus.DONE
          : ProjectStatus.ACTIVE;

  const where: Prisma.ProjectWhereInput = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { client: { companyName: { contains: q, mode: "insensitive" } } },
            { client: { contactPerson: { contains: q, mode: "insensitive" } } },
            { client: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // Rozjednané akvizice z AI Sales — oslovené firmy před výhrou. Zakázka
  // z nich vznikne až po vyhrané příležitosti, ale obchodní rozpracovanost
  // patří na oči vedle zakázek.
  const acquisitions = await prisma.salesLead.findMany({
    where: { status: { in: ["CONTACTED", "REPLIED", "MEETING", "PROPOSAL"] } },
    orderBy: { updatedAt: "desc" },
    include: {
      prospect: { select: { name: true, domain: true } },
      campaign: { select: { name: true } },
    },
  });

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          contactPerson: true,
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { createdAt: true },
          },
        },
      },
      phases: {
        orderBy: { position: "asc" },
        select: { id: true, name: true, position: true, completedAt: true },
      },
      tasks: { select: { done: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Zakázky
          </h1>
          <p className="text-sm text-slate-500">
            {projects.length === 0
              ? "Žádná zakázka neodpovídá filtru"
              : `${projects.length} ${pluralCs(projects.length, "zakázka", "zakázky", "zakázek")}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Seznam klientů je jen na archiv a klienty bez zakázky, proto není
              v navigaci — pracuje se se zakázkami. */}
          <Link
            href="/clients"
            className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Všichni klienti
          </Link>
          <Link
            href="/clients/new"
            className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Nový klient
          </Link>
        </div>
      </div>

      <ProjectFilter q={q ?? ""} status={status ?? "active"} />

      {projects.length === 0 ? (
        <EmptyState hasFilter={Boolean(q || status)} />
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => {
            const phases = sortPhases(project.phases);
            // Stejný pohled jako v detailu zakázky: progres měří hotové fáze,
            // ne odškrtané úkoly.
            const donePhases = phases.filter(
              (phase) => phase.completedAt !== null,
            ).length;
            const openTasks = project.tasks.filter((task) => !task.done).length;
            const lastContact = project.client.messages[0]?.createdAt ?? null;
            const stale = isContactStale(lastContact);
            const current = activePhase(phases);

            return (
              <li key={project.id}>
                <Link
                  href={`/clients/${project.client.id}?project=${project.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {project.client.companyName}
                      </p>
                      <p className="truncate text-sm text-slate-500">
                        {project.name}
                        {project.client.contactPerson
                          ? ` · ${project.client.contactPerson}`
                          : ""}
                      </p>
                    </div>
                    {current ? <PhaseBadge name={current.name} /> : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <ProgressBar
                      done={donePhases}
                      total={phases.length}
                      label={`${donePhases} z ${phases.length} fází`}
                      className="min-w-40 flex-1"
                    />
                    <span className="text-xs text-slate-500">
                      {openTasks === 0
                        ? "Úkoly hotové"
                        : unfinishedTasksPhrase(openTasks)}
                    </span>
                    <span
                      className={`text-xs ${stale ? "font-medium text-amber-700" : "text-slate-500"}`}
                    >
                      Poslední kontakt: {formatRelativeDays(lastContact)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {acquisitions.length > 0 ? (
        <section className="space-y-3">
          <div>
            <h2 className="font-medium text-slate-900">
              Rozjednané akvizice
            </h2>
            <p className="text-sm text-slate-500">
              Oslovené firmy z AI Sales. Zakázka z nich vznikne po výhře —
              výsledky zapisujte na detailu příležitosti.
            </p>
          </div>
          <ul className="space-y-1.5">
            {acquisitions.map((lead) => (
              <li key={lead.id}>
                <Link
                  href={`/sales/leads/${lead.id}`}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">
                      {lead.prospect.name}
                    </span>
                    <span className="block truncate text-sm text-slate-500">
                      {lead.campaign.name}
                      {lead.prospect.domain ? ` · ${lead.prospect.domain}` : ""}
                    </span>
                  </span>
                  <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs text-sky-800 ring-1 ring-sky-100 ring-inset">
                    {ACQUISITION_LABELS[lead.status] ?? lead.status}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatRelativeDays(lead.updatedAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const ACQUISITION_LABELS: Record<string, string> = {
  CONTACTED: "Oslovená",
  REPLIED: "Odpověděli",
  MEETING: "Schůzka",
  PROPOSAL: "Nabídka",
};

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="font-medium text-slate-900">
        {hasFilter ? "Nic jsme nenašli" : "Zatím žádná zakázka"}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
        {hasFilter
          ? "Zkuste upravit hledaný text nebo zrušit filtry."
          : "Založte prvního klienta a jeho zakázku. Úkoly se předvyplní ze šablony."}
      </p>
      {!hasFilter ? (
        <Link
          href="/clients/new"
          className="mt-4 inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Nový klient
        </Link>
      ) : null}
    </div>
  );
}

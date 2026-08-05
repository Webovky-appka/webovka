import Link from "next/link";
import { cookies } from "next/headers";
import { ProjectStatus, type Prisma } from "@prisma/client";

import { DailyDashboard } from "@/components/daily-dashboard";
import {
  DASHBOARD_DISMISS_COOKIE,
  type DashboardSection,
} from "@/lib/daily-dashboard";
import { PhaseBadge } from "@/components/phase-badge";
import { ProgressBar } from "@/components/progress-bar";
import { ProjectFilter } from "@/components/project-filter";
import { requireUser } from "@/lib/auth";
import {
  businessDayKey,
  formatDayHeading,
  formatRelativeDays,
  isContactStale,
  isDueTodayOrOverdue,
  isOverdue,
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

  // Denní přehled se počítá jen když není na dnešek zavřený křížkem.
  const dismissedDay = (await cookies()).get(DASHBOARD_DISMISS_COOKIE)?.value;
  const dayKey = businessDayKey();
  const dashboardSections =
    dismissedDay === dayKey ? null : await buildDashboardSections();

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

      {dashboardSections ? (
        <DailyDashboard
          dayKey={dayKey}
          heading={formatDayHeading()}
          sections={dashboardSections}
        />
      ) : null}

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

/**
 * Sekce denního přehledu: co dnes potřebuje ruce. Prázdné sekce komponenta
 * neukazuje, takže klidný den znamená prázdný panel, ne nulové řádky.
 */
async function buildDashboardSections(): Promise<DashboardSection[]> {
  const soon = new Date(Date.now() + 2 * 86_400_000);

  const [reviewLeads, repliedLeads, dueTasks, activeProjects] =
    await Promise.all([
      prisma.salesLead.findMany({
        where: {
          status: "READY_FOR_REVIEW",
          campaign: { status: { not: "ARCHIVED" } },
        },
        orderBy: { score: "desc" },
        include: { prospect: { select: { name: true } } },
      }),
      prisma.salesLead.findMany({
        where: {
          status: "REPLIED",
          campaign: { status: { not: "ARCHIVED" } },
        },
        orderBy: { updatedAt: "desc" },
        include: { prospect: { select: { name: true } } },
      }),
      // Hrubý předvýběr přes SQL (se zónovou rezervou), přesný český
      // kalendář rozhodne isDueTodayOrOverdue.
      prisma.task.findMany({
        where: { done: false, dueDate: { not: null, lte: soon } },
        orderBy: { dueDate: "asc" },
        include: {
          project: {
            select: {
              id: true,
              clientId: true,
              client: { select: { companyName: true } },
            },
          },
        },
      }),
      prisma.project.findMany({
        where: { status: ProjectStatus.ACTIVE },
        select: {
          id: true,
          name: true,
          client: {
            select: {
              id: true,
              companyName: true,
              messages: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { createdAt: true },
              },
            },
          },
        },
      }),
    ]);

  const todayTasks = dueTasks.filter((task) =>
    isDueTodayOrOverdue(task.dueDate),
  );

  const staleProjects = activeProjects
    .map((project) => ({
      project,
      lastContact: project.client.messages[0]?.createdAt ?? null,
    }))
    .filter(({ lastContact }) => isContactStale(lastContact))
    .sort(
      (a, b) => (a.lastContact?.getTime() ?? 0) - (b.lastContact?.getTime() ?? 0),
    );

  return [
    {
      key: "review",
      title: "Příležitosti ke schválení",
      count: reviewLeads.length,
      href: "/sales",
      tone: "emerald",
      items: reviewLeads.slice(0, 3).map((lead) => ({
        label: lead.prospect.name,
        href: `/sales/leads/${lead.id}`,
        meta: lead.score !== null ? `skóre ${lead.score}` : undefined,
        metaTone: "good" as const,
      })),
    },
    {
      key: "replied",
      title: "Odpověděli — zareagujte",
      count: repliedLeads.length,
      href: "/sales",
      tone: "sky",
      items: repliedLeads.slice(0, 3).map((lead) => ({
        label: lead.prospect.name,
        href: `/sales/leads/${lead.id}`,
        meta: formatRelativeDays(lead.updatedAt),
      })),
    },
    {
      key: "tasks",
      title: "Úkoly na dnes a po termínu",
      count: todayTasks.length,
      href: "/projects",
      tone: "amber",
      items: todayTasks.slice(0, 4).map((task) => ({
        label: `${task.title} · ${task.project.client.companyName}`,
        href: `/clients/${task.project.clientId}?project=${task.project.id}`,
        meta: isOverdue(task.dueDate) ? "po termínu" : "dnes",
        metaTone: isOverdue(task.dueDate)
          ? ("alert" as const)
          : ("default" as const),
      })),
    },
    {
      key: "stale",
      title: "Dlouho bez kontaktu",
      count: staleProjects.length,
      href: "/projects",
      tone: "slate",
      items: staleProjects.slice(0, 3).map(({ project, lastContact }) => ({
        label: project.client.companyName,
        href: `/clients/${project.client.id}?project=${project.id}`,
        meta: formatRelativeDays(lastContact),
      })),
    },
  ];
}

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

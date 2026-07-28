import Link from "next/link";
import { Phase, ProjectStatus, type Prisma } from "@prisma/client";

import { PhaseBadge } from "@/components/phase-badge";
import { ProgressBar } from "@/components/progress-bar";
import { requireUser } from "@/lib/auth";
import { formatRelativeDays } from "@/lib/format";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Zakázky — Stavba webu",
};

type SearchParams = {
  q?: string;
  phase?: string;
  status?: string;
};

function parsePhase(value: string | undefined): Phase | undefined {
  return PHASE_ORDER.find((phase) => phase === value);
}

export default async function ProjectsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  await requireUser();
  const { q, phase, status } = await props.searchParams;

  const phaseFilter = parsePhase(phase);
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
    ...(phaseFilter ? { phase: phaseFilter } : {}),
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
              : `${projects.length} ${projects.length === 1 ? "zakázka" : projects.length < 5 ? "zakázky" : "zakázek"}`}
          </p>
        </div>

        <Link
          href="/clients/new"
          className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Nový klient
        </Link>
      </div>

      <form className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Hledat klienta nebo zakázku"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />

        <select
          name="phase"
          defaultValue={phase ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        >
          <option value="">Všechny fáze</option>
          {PHASE_ORDER.map((value) => (
            <option key={value} value={value}>
              {PHASE_LABELS[value]}
            </option>
          ))}
        </select>

        <select
          name="status"
          defaultValue={status ?? "active"}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        >
          <option value="active">Aktivní</option>
          <option value="done">Dokončené</option>
          <option value="archived">Archivované</option>
          <option value="all">Vše</option>
        </select>

        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Filtrovat
        </button>
      </form>

      {projects.length === 0 ? (
        <EmptyState hasFilter={Boolean(q || phase || status)} />
      ) : (
        <ul className="space-y-2">
          {projects.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((task) => task.done).length;
            const lastContact = project.client.messages[0]?.createdAt ?? null;
            const stale =
              lastContact !== null &&
              Date.now() - lastContact.getTime() > 14 * 86_400_000;

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
                    <PhaseBadge phase={project.phase} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <ProgressBar
                      done={done}
                      total={total}
                      className="min-w-40 flex-1"
                    />
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
    </div>
  );
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

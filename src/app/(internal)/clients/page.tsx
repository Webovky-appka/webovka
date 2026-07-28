import Link from "next/link";
import { ClientStatus, type Prisma } from "@prisma/client";

import { PhaseBadge } from "@/components/phase-badge";
import { requireUser } from "@/lib/auth";
import { formatRelativeDays } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Klienti — Stavba webu",
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  LEAD: "Poptávka",
  ACTIVE: "Aktivní",
  DONE: "Dokončeno",
  ARCHIVED: "Archiv",
};

export default async function ClientsPage(props: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireUser();
  const { q, status } = await props.searchParams;

  const statusFilter = Object.values(ClientStatus).find((s) => s === status);

  const where: Prisma.ClientWhereInput = {
    ...(statusFilter
      ? { status: statusFilter }
      : { status: { not: ClientStatus.ARCHIVED } }),
    ...(q
      ? {
          OR: [
            { companyName: { contains: q, mode: "insensitive" } },
            { contactPerson: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const clients = await prisma.client.findMany({
    where,
    orderBy: { companyName: "asc" },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, phase: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Klienti
          </h1>
          <p className="text-sm text-slate-500">
            {clients.length === 0
              ? "Žádný klient neodpovídá filtru"
              : `${clients.length} ${clients.length === 1 ? "klient" : clients.length < 5 ? "klienti" : "klientů"}`}
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
          placeholder="Hledat podle firmy, osoby nebo e-mailu"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        >
          <option value="">Kromě archivu</option>
          {Object.values(ClientStatus).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Filtrovat
        </button>
      </form>

      {clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-900">Zatím žádný klient</p>
          <p className="mt-1 text-sm text-slate-500">
            Přidejte prvního klienta a jeho zakázku.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {clients.map((client) => (
            <li key={client.id}>
              <Link
                href={`/clients/${client.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {client.companyName}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {[client.contactPerson, client.email]
                      .filter(Boolean)
                      .join(" · ") || "Bez kontaktu"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {client.projects.slice(0, 2).map((project) => (
                    <PhaseBadge key={project.id} phase={project.phase} />
                  ))}
                  {client.projects.length > 2 ? (
                    <span className="text-xs text-slate-400">
                      +{client.projects.length - 2}
                    </span>
                  ) : null}
                  {client.projects.length === 0 ? (
                    <span className="text-xs text-slate-400">
                      bez zakázky
                    </span>
                  ) : null}
                  <span className="w-32 text-right text-xs text-slate-500">
                    {formatRelativeDays(client.messages[0]?.createdAt ?? null)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

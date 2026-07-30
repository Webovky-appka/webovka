import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorType, MessageKind } from "@prisma/client";

import { PortalView } from "@/components/portal/portal-view";
import { requireUser } from "@/lib/auth";
import { activePhase, sortPhases } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Náhled portálu — Mitsov Web",
};

/**
 * Ukáže interním uživatelům přesně to, co v portálu vidí klient, ale bez
 * tokenu a PINu. Data se čtou stejně jako v portálu, aby náhled nelhal.
 */
export default async function PortalPreviewPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  await requireUser();
  const { id } = await props.params;
  const { project: projectParam } = await props.searchParams;

  const client = await prisma.client.findUnique({
    where: { id },
    select: {
      id: true,
      companyName: true,
      projects: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          portalNote: true,
          previewUrl: true,
          phases: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!client) notFound();

  const project =
    client.projects.find((item) => item.id === projectParam) ??
    client.projects[0];

  if (!project) notFound();

  const current = activePhase(sortPhases(project.phases));

  const [approvals, feedback, files] = await Promise.all([
    prisma.approval.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, phaseName: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: {
        projectId: project.id,
        authorType: AuthorType.CLIENT,
        kind: MessageKind.PORTAL_FEEDBACK,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.attachment.findMany({
      where: { projectId: project.id, visibleInPortal: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, size: true },
    }),
  ]);

  const backHref = `/clients/${client.id}?project=${project.id}&tab=settings`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-amber-900">
            Náhled klientského portálu
          </p>
          <p className="text-xs text-amber-800">
            Takto vidí zakázku {project.name} klient {client.companyName}.
            Akce jsou vypnuté.
          </p>
        </div>
        <Link
          href={backHref}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm text-amber-900 transition hover:bg-amber-100"
        >
          Zpět na nastavení
        </Link>
      </div>

      {client.projects.length > 1 ? (
        <nav className="flex flex-wrap gap-1.5">
          {client.projects.map((item) => (
            <Link
              key={item.id}
              href={`/clients/${client.id}/preview?project=${item.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                item.id === project.id
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50">
        <PortalView
          readOnly
          data={{
            // Náhled nemá token, akce jsou vypnuté a nikam se neodesílá.
            token: "",
            companyName: client.companyName,
            projectName: project.name,
            phases: project.phases,
            currentPhaseName: current?.name ?? null,
            currentPhaseDueDate: current?.dueDate ?? null,
            portalNote: project.portalNote,
            previewUrl: project.previewUrl,
            currentPhaseApproved: approvals.some(
              (approval) => approval.phaseName === current?.name,
            ),
            approvals,
            feedback,
            files,
          }}
        />
      </div>
    </div>
  );
}

import { cookies } from "next/headers";
import { AuthorType, MessageKind } from "@prisma/client";

import { PinGate } from "@/components/portal/pin-gate";
import { PortalView } from "@/components/portal/portal-view";
import { activePhase, sortPhases } from "@/lib/phases";
import { hashPortalToken, isLinkUsable } from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import { portalCookieName, verifyToken } from "@/lib/session";

export const metadata = {
  title: "Váš projekt",
  robots: { index: false, follow: false },
};

export default async function PortalPage(props: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await props.params;

  const link = await prisma.portalLink.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    include: {
      project: {
        include: {
          client: { select: { companyName: true } },
          phases: { orderBy: { position: "asc" } },
        },
      },
    },
  });

  if (!link || !isLinkUsable(link)) {
    return <ExpiredNotice />;
  }

  const store = await cookies();
  const hasSession =
    verifyToken(store.get(portalCookieName(link.id))?.value) === link.id;

  if (!hasSession) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <PinGate token={token} projectName={link.project.name} />
      </main>
    );
  }

  const current = activePhase(sortPhases(link.project.phases));

  const [approvals, feedback, files] = await Promise.all([
    prisma.approval.findMany({
      where: { projectId: link.projectId },
      orderBy: { createdAt: "desc" },
      select: { id: true, phaseName: true, createdAt: true },
    }),
    prisma.message.findMany({
      where: {
        projectId: link.projectId,
        authorType: AuthorType.CLIENT,
        kind: MessageKind.PORTAL_FEEDBACK,
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, body: true, createdAt: true },
    }),
    prisma.attachment.findMany({
      where: { projectId: link.projectId, visibleInPortal: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, filename: true, size: true },
    }),
  ]);

  return (
    <main className="flex-1">
      <PortalView
        data={{
          token,
          companyName: link.project.client.companyName,
          projectName: link.project.name,
          phases: link.project.phases,
          currentPhaseName: current?.name ?? null,
          currentPhaseDueDate: current?.dueDate ?? null,
          portalNote: link.project.portalNote,
          previewUrl: link.project.previewUrl,
          currentPhaseApproved: approvals.some(
            (approval) => approval.phaseName === current?.name,
          ),
          approvals,
          feedback,
          files,
        }}
      />
    </main>
  );
}

function ExpiredNotice() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-slate-900">
          Odkaz už neplatí
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Odkaz byl zneplatněn nebo mu vypršela platnost. Napište nám a pošleme
          vám nový.
        </p>
      </div>
    </main>
  );
}

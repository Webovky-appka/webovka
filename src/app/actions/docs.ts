"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { docTemplate, type DocContext } from "@/lib/doc-templates";
import { logSystemEvent } from "@/lib/events";
import { hasDocsAccess } from "@/lib/google";
import { createGoogleDoc } from "@/lib/google-docs";
import { activePhase, sortPhases } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export type DocFormState = { error?: string } | undefined;

/**
 * Založí dokument v Google Docs a uloží si na něj odkaz. Text předlohy skládáme
 * u nás — do Docs se posílá hotový, aby uživatel viděl přesně to, co dostane.
 */
export async function createProjectDoc(
  _prevState: DocFormState,
  formData: FormData,
): Promise<DocFormState> {
  const user = await requireUser();

  const projectId = formData.get("projectId");
  const templateKey = formData.get("template");
  const titleInput = formData.get("title");

  if (typeof projectId !== "string" || projectId === "") {
    return { error: "Chybí identifikátor zakázky." };
  }

  const template = docTemplate(
    typeof templateKey === "string" ? templateKey : "",
  );
  if (!template) return { error: "Vyberte předlohu dokumentu." };

  const account = await prisma.googleAccount.findUnique({
    where: { userId: user.id },
    select: { scope: true },
  });
  if (!account) {
    return { error: "Nejdřív napojte účet Google v Nastavení." };
  }
  if (!hasDocsAccess(account.scope)) {
    return {
      error:
        "Napojení Google účtu je starší a nemá právo zakládat dokumenty. Napojte účet znovu v Nastavení.",
    };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      clientId: true,
      client: { select: { companyName: true, contactPerson: true } },
      phases: {
        select: { id: true, name: true, position: true, completedAt: true },
      },
    },
  });
  if (!project) return { error: "Zakázka neexistuje." };

  const context: DocContext = {
    clientName: project.client.companyName,
    contactPerson: project.client.contactPerson,
    projectName: project.name,
    phaseName: activePhase(sortPhases(project.phases))?.name ?? null,
    authorName: user.name,
    today: new Date(),
  };

  const customTitle =
    typeof titleInput === "string" && titleInput.trim() !== ""
      ? titleInput.trim()
      : null;
  const title = customTitle ?? template.title(context);

  const created = await createGoogleDoc({
    userId: user.id,
    title,
    body: template.body(context),
  });
  if ("error" in created) return { error: created.error };

  await prisma.projectDoc.create({
    data: {
      projectId: project.id,
      title,
      docId: created.docId,
      webViewLink: created.webViewLink,
      templateKey: template.key,
      createdById: user.id,
    },
  });

  // Klient tenhle zápis nevidí, portál ukazuje jen svoje vlákno.
  await logSystemEvent({
    clientId: project.clientId,
    projectId: project.id,
    body: `${user.name} založil dokument „${title}“ v Google Docs.`,
  });

  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/docs");
  return undefined;
}

/**
 * Odebere odkaz na dokument. Soubor v Google Drive zůstane — mazat cizí obsah
 * z aplikace by bylo nemilé překvapení.
 */
export async function removeProjectDoc(formData: FormData) {
  await requireUser();

  const docId = formData.get("docId");
  if (typeof docId !== "string" || docId === "") return;

  const doc = await prisma.projectDoc.findUnique({
    where: { id: docId },
    select: { project: { select: { clientId: true } } },
  });
  if (!doc) return;

  await prisma.projectDoc.delete({ where: { id: docId } });

  revalidatePath(`/clients/${doc.project.clientId}`);
  revalidatePath("/docs");
}

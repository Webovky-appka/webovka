"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteFile } from "@/lib/storage";

export type DeleteClientState = { error?: string } | undefined;

/**
 * Nevratné smazání klienta pro případ žádosti o výmaz osobních údajů.
 * Archivace je jinde a je to výchozí volba — tohle maže i přílohy z úložiště
 * a celou historii komunikace.
 */
export async function deleteClientPermanently(
  _prevState: DeleteClientState,
  formData: FormData,
): Promise<DeleteClientState> {
  await requireUser();

  const clientId = formData.get("clientId");
  const confirmation = formData.get("confirmation");

  if (typeof clientId !== "string" || clientId === "") {
    return { error: "Chybí identifikátor klienta." };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      companyName: true,
      attachments: { select: { storageKey: true } },
    },
  });
  if (!client) return { error: "Klient neexistuje." };

  if (
    typeof confirmation !== "string" ||
    confirmation.trim() !== client.companyName
  ) {
    return {
      error: `Pro potvrzení opište přesně název firmy: ${client.companyName}`,
    };
  }

  // Soubory mažeme před záznamem, ať po nepovedeném mazání nezůstanou osiřelé.
  const failedFiles: string[] = [];
  for (const attachment of client.attachments) {
    try {
      await deleteFile(attachment.storageKey);
    } catch {
      failedFiles.push(attachment.storageKey);
    }
  }

  if (failedFiles.length > 0) {
    return {
      error: `Nepodařilo se smazat ${failedFiles.length} souborů z úložiště. Klient zůstal zachován, zkuste to znovu.`,
    };
  }

  // Zakázky, úkoly, zprávy, schválení a portálové odkazy padají kaskádou.
  await prisma.client.delete({ where: { id: clientId } });

  revalidatePath("/clients");
  revalidatePath("/projects");
  redirect("/clients");
}

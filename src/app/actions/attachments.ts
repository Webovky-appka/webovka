"use server";

import { AttachmentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  deleteFile,
  saveFile,
} from "@/lib/storage";

export type AttachmentState = { error?: string } | undefined;

export async function uploadAttachment(
  _prevState: AttachmentState,
  formData: FormData,
): Promise<AttachmentState> {
  const user = await requireUser();

  const clientId = formData.get("clientId");
  const projectId = formData.get("projectId");
  const kindValue = formData.get("kind");
  const taskId = formData.get("taskId");
  const file = formData.get("file");

  if (typeof clientId !== "string" || clientId === "") {
    return { error: "Chybí identifikátor klienta." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Vyberte soubor." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error: `Soubor je větší než ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    };
  }
  if (!ALLOWED_MIME_TYPES.some((type) => type === file.type)) {
    return { error: "Tento typ souboru nepodporujeme." };
  }

  const kind =
    Object.values(AttachmentKind).find((value) => value === kindValue) ??
    AttachmentKind.OTHER;

  const { storageKey } = await saveFile(clientId, file);

  await prisma.attachment.create({
    data: {
      clientId,
      projectId:
        typeof projectId === "string" && projectId !== "" ? projectId : null,
      taskId: typeof taskId === "string" && taskId !== "" ? taskId : null,
      filename: file.name,
      kind,
      mimeType: file.type,
      size: file.size,
      storageKey,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  return undefined;
}

export async function deleteAttachment(formData: FormData) {
  await requireUser();

  const attachmentId = formData.get("attachmentId");
  if (typeof attachmentId !== "string") return;

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, clientId: true, storageKey: true },
  });
  if (!attachment) return;

  await prisma.attachment.delete({ where: { id: attachment.id } });
  await deleteFile(attachment.storageKey);

  revalidatePath(`/clients/${attachment.clientId}`);
}

export async function toggleAttachmentVisibility(formData: FormData) {
  await requireUser();

  const attachmentId = formData.get("attachmentId");
  if (typeof attachmentId !== "string") return;

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: { id: true, clientId: true, visibleInPortal: true },
  });
  if (!attachment) return;

  await prisma.attachment.update({
    where: { id: attachment.id },
    data: { visibleInPortal: !attachment.visibleInPortal },
  });

  revalidatePath(`/clients/${attachment.clientId}`);
}

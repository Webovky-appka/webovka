"use server";

import { AuthorType, MessageKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type MessageFormState = { error?: string } | undefined;

const MessageSchema = z.object({
  clientId: z.string().trim().min(1),
  projectId: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  kind: z.enum(MessageKind),
  body: z.string().trim().min(1, "Napište text záznamu."),
});

/** Typy, které smí zapsat interní uživatel. Portál a systém mají vlastní cesty. */
const USER_MESSAGE_KINDS = [
  MessageKind.NOTE,
  MessageKind.EMAIL,
  MessageKind.CALL,
  MessageKind.MEETING,
] as const;

export async function createMessage(
  _prevState: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const user = await requireUser();

  const parsed = MessageSchema.safeParse({
    clientId: formData.get("clientId"),
    projectId: formData.get("projectId"),
    kind: formData.get("kind"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  if (!USER_MESSAGE_KINDS.some((kind) => kind === parsed.data.kind)) {
    return { error: "Tento typ záznamu nelze zapsat ručně." };
  }

  await prisma.message.create({
    data: {
      clientId: parsed.data.clientId,
      projectId: parsed.data.projectId,
      kind: parsed.data.kind,
      body: parsed.data.body,
      authorType: AuthorType.USER,
      authorId: user.id,
    },
  });

  revalidatePath(`/clients/${parsed.data.clientId}`);
  revalidatePath("/projects");
  return undefined;
}

export async function deleteMessage(formData: FormData) {
  const user = await requireUser();

  const messageId = formData.get("messageId");
  if (typeof messageId !== "string") return;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { clientId: true, authorType: true, authorId: true },
  });
  if (!message) return;

  // Připomínky klienta a systémové události zůstávají jako doklad.
  if (message.authorType !== AuthorType.USER) return;
  if (message.authorId !== user.id) return;

  await prisma.message.delete({ where: { id: messageId } });

  revalidatePath(`/clients/${message.clientId}`);
}

export async function togglePinMessage(formData: FormData) {
  await requireUser();

  const messageId = formData.get("messageId");
  if (typeof messageId !== "string") return;

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { clientId: true, pinned: true },
  });
  if (!message) return;

  await prisma.message.update({
    where: { id: messageId },
    data: { pinned: !message.pinned },
  });

  revalidatePath(`/clients/${message.clientId}`);
}

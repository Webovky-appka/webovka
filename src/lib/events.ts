import "server-only";

import { AuthorType, MessageKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/**
 * Zapíše automatickou událost do komunikace klienta. Timeline tím slouží
 * i jako audit log — kdo kdy změnil fázi, vygeneroval odkaz nebo co schválil klient.
 */
export async function logSystemEvent({
  clientId,
  projectId,
  body,
}: {
  clientId: string;
  projectId?: string | null;
  body: string;
}) {
  await prisma.message.create({
    data: {
      clientId,
      projectId: projectId ?? null,
      authorType: AuthorType.SYSTEM,
      kind: MessageKind.SYSTEM_EVENT,
      body,
    },
  });
}

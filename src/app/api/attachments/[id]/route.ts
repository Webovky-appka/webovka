import { cookies } from "next/headers";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { portalCookieName, verifyToken } from "@/lib/session";

/**
 * Výdej příloh. Soubory nikdy nemají veřejnou adresu — vydáváme je jen
 * přihlášenému uživateli, nebo klientovi, který prošel PIN gate a jde
 * o přílohu výslovně zpřístupněnou v portálu.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      filename: true,
      mimeType: true,
      storageKey: true,
      visibleInPortal: true,
      projectId: true,
    },
  });

  // Neexistující i nedostupná příloha vrací 404, ať nejde zjišťovat, co existuje.
  if (!attachment) return new Response("Nenalezeno", { status: 404 });

  if (!(await isAllowed(attachment))) {
    return new Response("Nenalezeno", { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(attachment.storageKey);
  } catch {
    return new Response("Soubor se nepodařilo načíst", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mimeType,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(attachment.filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

async function isAllowed(attachment: {
  visibleInPortal: boolean;
  projectId: string | null;
}): Promise<boolean> {
  if (await getCurrentUser()) return true;
  if (!attachment.visibleInPortal || !attachment.projectId) return false;

  const links = await prisma.portalLink.findMany({
    where: { projectId: attachment.projectId, active: true },
    select: { id: true },
  });
  if (links.length === 0) return false;

  const store = await cookies();
  return links.some(
    (link) => verifyToken(store.get(portalCookieName(link.id))?.value) === link.id,
  );
}

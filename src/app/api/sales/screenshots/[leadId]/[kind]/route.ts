import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SCREENSHOT_CONTENT_TYPE } from "@/lib/sales/screenshot";
import { readFile } from "@/lib/storage";

/**
 * Výdej screenshotů webů leadů. Jen pro přihlášené interní uživatele —
 * screenshoty nemají veřejnou adresu a do klientského portálu nepatří.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ leadId: string; kind: string }> },
) {
  if (!(await getCurrentUser())) {
    return new Response("Nenalezeno", { status: 404 });
  }

  const { leadId, kind } = await context.params;
  if (kind !== "desktop" && kind !== "mobile") {
    return new Response("Nenalezeno", { status: 404 });
  }

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { screenshotDesktopKey: true, screenshotMobileKey: true },
  });
  const storageKey =
    kind === "desktop" ? lead?.screenshotDesktopKey : lead?.screenshotMobileKey;
  if (!storageKey) return new Response("Nenalezeno", { status: 404 });

  let bytes: Buffer;
  try {
    bytes = await readFile(storageKey);
  } catch {
    return new Response("Soubor se nepodařilo načíst", { status: 404 });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": SCREENSHOT_CONTENT_TYPE,
      "Content-Length": String(bytes.length),
      // Soukromá cache: obrázek se mezi F5 nemění, ale nesmí ležet na proxy.
      "Cache-Control": "private, max-age=300",
    },
  });
}

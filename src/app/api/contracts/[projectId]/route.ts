import { NextResponse, type NextRequest } from "next/server";

import { requireUser } from "@/lib/auth";
import { contractFileName, contractToDocx } from "@/lib/contract-docx";
import { prisma } from "@/lib/prisma";

/** Stažení uložené smlouvy jako Word. Přihlášení ověřuje requireUser. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  await requireUser();
  const { projectId } = await params;

  const contract = await prisma.contract.findUnique({
    where: { projectId },
    select: { body: true, project: { select: { name: true } } },
  });

  if (!contract) {
    return NextResponse.json({ error: "Smlouva nenalezena." }, { status: 404 });
  }

  const file = await contractToDocx({
    text: contract.body,
    title: `Smlouva o dílo — ${contract.project.name}`,
  });

  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${contractFileName(contract.project.name)}"`,
      "Content-Length": String(file.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

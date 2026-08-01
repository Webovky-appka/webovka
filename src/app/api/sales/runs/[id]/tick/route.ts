import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { tickRun } from "@/lib/sales/run";

/**
 * Jeden krok běhu kampaně. Volá ho stránka běhu ve smyčce, dokud běh neskončí
 * — pracovníkem je otevřená karta prohlížeče. Plánované spouštění přibude
 * později se svým vlastním ověřením.
 */
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nepřihlášen." }, { status: 401 });
  }

  const { id } = await params;
  const snapshot = await tickRun(id);

  if (!snapshot) {
    return NextResponse.json({ error: "Běh nenalezen." }, { status: 404 });
  }

  return NextResponse.json(snapshot);
}

import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { tickRun } from "@/lib/sales/run";
import { isValidTickToken, salesTickToken } from "@/lib/sales/run-auth";

/**
 * Jeden krok běhu kampaně. Řetěz si server drží sám: po odeslání odpovědi
 * naplánuje další tick, dokud běh neskončí. Stránka běhu stav jen čte (GET)
 * a jako pojistka může tick kopnout (POST) — třeba po restartu serveru,
 * který řetěz přetrhl. Souběh hlídá rezervace v tickRun.
 */
export const maxDuration = 300;

const TICK_HEADER = "x-sales-tick";

async function authorized(request: NextRequest): Promise<boolean> {
  if (isValidTickToken(request.headers.get(TICK_HEADER))) return true;
  return (await getCurrentUser()) !== null;
}

/** Naváže řetěz: po odpovědi zavolá další tick s interním tokenem. */
function chainNextTick(request: NextRequest, runId: string): void {
  const url = new URL(`/api/sales/runs/${runId}/tick`, request.nextUrl.origin);

  after(async () => {
    try {
      await fetch(url, {
        method: "POST",
        headers: { [TICK_HEADER]: salesTickToken() },
        cache: "no-store",
      });
    } catch (error) {
      // Přetržený řetěz není havárie — kopne ho stránka běhu nebo další run.
      console.error("[sales] Navázání dalšího ticku selhalo:", error);
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Nepřihlášen." }, { status: 401 });
  }

  const { id } = await params;
  const snapshot = await tickRun(id);

  if (!snapshot) {
    return NextResponse.json({ error: "Běh nenalezen." }, { status: 404 });
  }

  // pending -1 = rezervaci drží jiný tick; řetěz vede on, nenavazujeme.
  if (snapshot.status === "RUNNING" && snapshot.pending !== -1) {
    chainNextTick(request, id);
  }

  return NextResponse.json(snapshot);
}

/** Stav běhu bez práce — pro stránku, která ho zobrazuje. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await authorized(request))) {
    return NextResponse.json({ error: "Nepřihlášen." }, { status: 401 });
  }

  const { id } = await params;
  const { prisma } = await import("@/lib/prisma");
  const run = await prisma.salesRun.findUnique({
    where: { id },
    select: { id: true, status: true, stats: true },
  });

  if (!run) {
    return NextResponse.json({ error: "Běh nenalezen." }, { status: 404 });
  }

  return NextResponse.json({
    id: run.id,
    status: run.status,
    stats: run.stats ?? {},
  });
}

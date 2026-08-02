import { NextResponse, type NextRequest } from "next/server";
import { after } from "next/server";

import { isAiConfigured } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { isValidTickToken, salesTickToken } from "@/lib/sales/run-auth";

/**
 * Plánované spouštění kampaní (sekce 22 specifikace). Volá ho Vercel Cron
 * ráno; pro každou aktivní kampaň s odpovídajícím rozvrhem založí běh
 * a kopne jeho řetěz. Uživatel pak přijde k hotovým leadům ke schválení.
 *
 * Idempotentní: kampaň s běhícím nebo dnes už založeným během se přeskočí,
 * takže opakované zavolání nic nezdvojí.
 */
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  // Vercel Cron posílá Authorization: Bearer <CRON_SECRET>, když je nastavený.
  const bearer = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    bearer === `Bearer ${process.env.CRON_SECRET}`
  ) {
    return true;
  }
  // Ruční kopnutí interním tokenem — pro vývoj a nouzové spuštění.
  return isValidTickToken(request.headers.get("x-sales-tick"));
}

/** Dnešek v Praze — plánuje se podle českého kalendáře, ne podle UTC serveru. */
function pragueToday(): { dayKey: string; isWeekday: boolean } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    isWeekday: !["Sat", "Sun"].includes(get("weekday")),
  };
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  if (!isAiConfigured()) {
    return NextResponse.json(
      { started: [], skipped: "chybí OPENAI_API_KEY" },
      { status: 200 },
    );
  }

  const { dayKey, isWeekday } = pragueToday();

  const campaigns = await prisma.salesCampaign.findMany({
    where: {
      status: "ACTIVE",
      schedule: isWeekday ? { in: ["DAILY", "WEEKDAYS"] } : "DAILY",
    },
    select: { id: true, name: true },
  });

  const started: string[] = [];
  const skipped: string[] = [];

  // Hranice dneška v Praze, hrubě: den v Praze začíná nejvýš o 2 h dřív než v UTC.
  const todayStart = new Date(`${dayKey}T00:00:00+02:00`);

  for (const campaign of campaigns) {
    const existing = await prisma.salesRun.findFirst({
      where: {
        campaignId: campaign.id,
        OR: [
          { status: { in: ["QUEUED", "RUNNING"] } },
          { createdAt: { gte: todayStart } },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      skipped.push(campaign.name);
      continue;
    }

    const run = await prisma.salesRun.create({
      data: { campaignId: campaign.id },
      select: { id: true },
    });
    started.push(campaign.name);

    const url = new URL(
      `/api/sales/runs/${run.id}/tick`,
      request.nextUrl.origin,
    );
    after(async () => {
      try {
        await fetch(url, {
          method: "POST",
          headers: { "x-sales-tick": salesTickToken() },
          cache: "no-store",
        });
      } catch (error) {
        console.error("[sales] Kopnutí naplánovaného běhu selhalo:", error);
      }
    });
  }

  return NextResponse.json({ started, skipped });
}

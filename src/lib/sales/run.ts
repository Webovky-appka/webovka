import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { discoverCandidates, qualifyLead } from "@/lib/sales/scout";

/**
 * Běh kampaně jako stavový stroj krokovaný zvenčí. Jeden tick udělá omezený
 * kus práce a vrátí stav — dlouhá práce se tak nedrží v jednom requestu
 * (sekce 35 specifikace) a pád jednoho kroku neshodí celý běh (sekce 36).
 * Ticky řídí otevřená stránka běhu; plánovač je přijde jen doplnit.
 */

/** Kolik leadů se kvalifikuje v jednom ticku. Málo, ať se tick vejde do limitu. */
const QUALIFY_PER_TICK = 2;

/** Po kolika neúspěších se lead přestane zkoušet a přeskočí se. */
const MAX_ATTEMPTS = 2;

export type RunStats = {
  discovered: boolean;
  inspected: number;
  created: number;
  skipped: { name: string; reason: string }[];
  leadIds: string[];
  attempts: Record<string, number>;
  qualified: number;
  rejected: number;
  overLimit: number;
  errors: string[];
  log: { at: string; text: string }[];
};

const EMPTY_STATS: RunStats = {
  discovered: false,
  inspected: 0,
  created: 0,
  skipped: [],
  leadIds: [],
  attempts: {},
  qualified: 0,
  rejected: 0,
  overLimit: 0,
  errors: [],
  log: [],
};

export type RunSnapshot = {
  id: string;
  status: string;
  stats: RunStats;
  /** Kolik leadů ještě čeká na kvalifikaci. */
  pending: number;
};

function readStats(value: Prisma.JsonValue | null): RunStats {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return structuredClone(EMPTY_STATS);
  }
  return { ...structuredClone(EMPTY_STATS), ...(value as Partial<RunStats>) };
}

function log(stats: RunStats, text: string): void {
  stats.log.push({ at: new Date().toISOString(), text });
}

async function saveRun(
  runId: string,
  stats: RunStats,
  data: Prisma.SalesRunUpdateInput = {},
): Promise<void> {
  await prisma.salesRun.update({
    where: { id: runId },
    data: { ...data, stats: stats as unknown as Prisma.InputJsonValue },
  });
}

/** Leady z tohoto běhu, které ještě čekají na kvalifikaci. */
async function pendingLeadIds(stats: RunStats): Promise<string[]> {
  if (stats.leadIds.length === 0) return [];

  const waiting = await prisma.salesLead.findMany({
    where: { id: { in: stats.leadIds }, status: "DISCOVERED" },
    select: { id: true },
  });

  return waiting
    .map((lead) => lead.id)
    .filter((id) => (stats.attempts[id] ?? 0) < MAX_ATTEMPTS);
}

export async function tickRun(runId: string): Promise<RunSnapshot | null> {
  const run = await prisma.salesRun.findUnique({
    where: { id: runId },
    include: { campaign: true },
  });
  if (!run) return null;

  const stats = readStats(run.stats);

  if (run.status === "COMPLETED" || run.status === "FAILED") {
    return { id: run.id, status: run.status, stats, pending: 0 };
  }

  // Převzetí běhu podmíněným zápisem — dva souběžné ticky ho nespustí dvakrát.
  if (run.status === "QUEUED") {
    const claimed = await prisma.salesRun.updateMany({
      where: { id: runId, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date() },
    });
    if (claimed.count === 0) {
      return { id: run.id, status: "RUNNING", stats, pending: 0 };
    }
  }

  // Krok 1: objevování kandidátů. Jeden tick, jedno volání s web search.
  if (!stats.discovered) {
    log(stats, "Scout začal hledat kandidáty.");
    const outcome = await discoverCandidates({
      campaign: run.campaign,
      runId: run.id,
    });

    if (!outcome.ok) {
      log(stats, `Hledání selhalo: ${outcome.error}`);
      stats.errors.push(outcome.error ?? "neznámá chyba");
      await saveRun(runId, stats, {
        status: "FAILED",
        error: outcome.error,
        finishedAt: new Date(),
      });
      return { id: run.id, status: "FAILED", stats, pending: 0 };
    }

    stats.discovered = true;
    stats.inspected = outcome.inspected;
    stats.created = outcome.createdLeadIds.length;
    stats.leadIds = outcome.createdLeadIds;
    stats.skipped = outcome.skipped;
    log(
      stats,
      `Prohlédnuto ${outcome.inspected} kandidátů, založeno ${outcome.createdLeadIds.length} leadů, přeskočeno ${outcome.skipped.length}.`,
    );
    if (outcome.summary) log(stats, `Scout: ${outcome.summary}`);

    await saveRun(runId, stats);
    const pending = await pendingLeadIds(stats);
    if (pending.length > 0) {
      return { id: run.id, status: "RUNNING", stats, pending: pending.length };
    }
    // Bez kandidátů není co kvalifikovat, běh rovnou končí.
  }

  // Krok 2: kvalifikace po malých dávkách.
  const pending = await pendingLeadIds(stats);
  const batch = pending.slice(0, QUALIFY_PER_TICK);

  for (const leadId of batch) {
    stats.attempts[leadId] = (stats.attempts[leadId] ?? 0) + 1;

    const outcome = await qualifyLead({
      leadId,
      campaign: run.campaign,
      runId: run.id,
      qualifiedSoFar: stats.qualified,
    });

    if (!outcome.ok) {
      stats.errors.push(`Lead ${leadId}: ${outcome.error}`);
      log(stats, `Kvalifikace leadu selhala: ${outcome.error}`);
      continue;
    }

    if (outcome.status === "QUALIFIED") stats.qualified += 1;
    else if (outcome.status === "REJECTED") stats.rejected += 1;
    else stats.overLimit += 1;
  }

  const remaining = await pendingLeadIds(stats);

  if (remaining.length === 0) {
    log(
      stats,
      `Hotovo: ${stats.qualified} kvalifikovaných, ${stats.rejected} zamítnutých, ${stats.overLimit} nad limit.`,
    );
    await saveRun(runId, stats, { status: "COMPLETED", finishedAt: new Date() });
    return { id: run.id, status: "COMPLETED", stats, pending: 0 };
  }

  await saveRun(runId, stats);
  return { id: run.id, status: "RUNNING", stats, pending: remaining.length };
}

import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { auditLead } from "@/lib/sales/auditor";
import { researchContact } from "@/lib/sales/contact";
import { draftOutreach } from "@/lib/sales/outreach";
import { discoverCandidates, qualifyLead } from "@/lib/sales/scout";

/**
 * Běh kampaně jako stavový stroj krokovaný zvenčí. Jeden tick udělá omezený
 * kus práce a vrátí stav — dlouhá práce se tak nedrží v jednom requestu
 * (sekce 35 specifikace) a pád jednoho kroku neshodí celý běh (sekce 36).
 *
 * Ticky si řetězí server sám (route handler po odpovědi zavolá další tick);
 * stránka běhu stav jen zobrazuje a slouží jako pojistka, kdyby řetěz umřel
 * s restartem serveru. Souběh hlídá rezervace claimedUntil — atomický zápis,
 * druhý tick bez rezervace odejde bez práce.
 */

/** Kolik leadů se kvalifikuje v jednom ticku. Málo, ať se tick vejde do limitu. */
const QUALIFY_PER_TICK = 2;

/** Audit je velké volání, na tick jde jeden. */
const AUDIT_PER_TICK = 1;

/** Contact research volá web search, na tick jeden. Návrhy e-mailů po dvou. */
const CONTACT_PER_TICK = 1;
const OUTREACH_PER_TICK = 2;

/** Po kolika neúspěších se lead přestane zkoušet a přeskočí se. */
const MAX_ATTEMPTS = 2;

/**
 * Jak dlouho platí rezervace ticku. Déle než timeout volání modelu, aby
 * rezervace nevypršela uprostřed práce; po pádu serveru se běh sám uvolní.
 */
const CLAIM_MS = 150_000;

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
  audited: number;
  auditAttempts: Record<string, number>;
  contacts: number;
  contactAttempts: Record<string, number>;
  drafts: number;
  outreachAttempts: Record<string, number>;
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
  audited: 0,
  auditAttempts: {},
  contacts: 0,
  contactAttempts: {},
  drafts: 0,
  outreachAttempts: {},
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
    data: {
      ...data,
      stats: stats as unknown as Prisma.InputJsonValue,
      // Tick končí, rezervace se vrací. Další tick si ji vezme hned.
      claimedUntil: null,
    },
  });
}

/**
 * Fáze po kvalifikaci se dívají na celou kampaň, ne jen na leady z tohoto
 * běhu — běh tak posbírá i leady, které dřívější běh nechal na půli cesty
 * (spadlý audit, restart). Limity pokusů drží mapa v statistikách běhu,
 * takže jeden běh nikdy nezkouší totéž donekonečna.
 */

/** Leady s auditem čekající na dohledání kontaktu (stav QUALIFIED + audit). */
async function pendingContactIds(
  stats: RunStats,
  campaignId: string,
): Promise<string[]> {
  const waiting = await prisma.salesLead.findMany({
    where: { campaignId, status: "QUALIFIED", audits: { some: {} } },
    select: { id: true },
  });

  return waiting
    .map((lead) => lead.id)
    .filter((id) => (stats.contactAttempts[id] ?? 0) < MAX_ATTEMPTS);
}

/** Leady po contact researchi čekající na návrh e-mailu. */
async function pendingOutreachIds(
  stats: RunStats,
  campaignId: string,
): Promise<string[]> {
  const waiting = await prisma.salesLead.findMany({
    where: { campaignId, status: "RESEARCHING" },
    select: { id: true },
  });

  return waiting
    .map((lead) => lead.id)
    .filter((id) => (stats.outreachAttempts[id] ?? 0) < MAX_ATTEMPTS);
}

/** Kvalifikované leady kampaně bez auditu. */
async function pendingAuditIds(
  stats: RunStats,
  campaignId: string,
): Promise<string[]> {
  const waiting = await prisma.salesLead.findMany({
    where: { campaignId, status: "QUALIFIED", audits: { none: {} } },
    select: { id: true },
  });

  return waiting
    .map((lead) => lead.id)
    .filter((id) => (stats.auditAttempts[id] ?? 0) < MAX_ATTEMPTS);
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
  const SENDER_FALLBACK = "Mitsov Web";
  const run = await prisma.salesRun.findUnique({
    where: { id: runId },
    include: { campaign: true },
  });
  if (!run) return null;

  const stats = readStats(run.stats);

  if (run.status === "COMPLETED" || run.status === "FAILED") {
    return { id: run.id, status: run.status, stats, pending: 0 };
  }

  // Rezervace běhu na dobu jednoho ticku. Kdo ji nezíská, jen vrátí stav —
  // ticky se potkávají (řetěz + pojistka ze stránky) a práce smí běžet jednou.
  const now = new Date();
  const claimed = await prisma.salesRun.updateMany({
    where: {
      id: runId,
      status: { in: ["QUEUED", "RUNNING"] },
      OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }],
    },
    data: {
      status: "RUNNING",
      claimedUntil: new Date(now.getTime() + CLAIM_MS),
      ...(run.status === "QUEUED" ? { startedAt: now } : {}),
    },
  });
  if (claimed.count === 0) {
    return { id: run.id, status: "RUNNING", stats, pending: -1 };
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

  const remainingQualify = await pendingLeadIds(stats);
  if (remainingQualify.length > 0) {
    await saveRun(runId, stats);
    return {
      id: run.id,
      status: "RUNNING",
      stats,
      pending: remainingQualify.length,
    };
  }

  // Krok 3: hluboký audit kvalifikovaných — až po dokončené kvalifikaci,
  // aby se drahé volání nedělalo u leadů, které by kvalifikace zamítla.
  const pendingAudits = await pendingAuditIds(stats, run.campaignId);
  for (const leadId of pendingAudits.slice(0, AUDIT_PER_TICK)) {
    stats.auditAttempts[leadId] = (stats.auditAttempts[leadId] ?? 0) + 1;

    const outcome = await auditLead({
      leadId,
      campaign: run.campaign,
      runId: run.id,
    });

    if (!outcome.ok) {
      stats.errors.push(`Audit ${leadId}: ${outcome.error}`);
      log(stats, `Audit leadu selhal: ${outcome.error}`);
      continue;
    }

    stats.audited += 1;
    log(stats, `Audit dokončen, výsledné skóre ${outcome.finalScore}.`);
  }

  const remainingAudits = await pendingAuditIds(stats, run.campaignId);
  if (remainingAudits.length > 0) {
    await saveRun(runId, stats);
    return {
      id: run.id,
      status: "RUNNING",
      stats,
      pending: remainingAudits.length,
    };
  }

  // Krok 4: dohledání kontaktů k auditovaným leadům.
  const pendingContacts = await pendingContactIds(stats, run.campaignId);
  for (const leadId of pendingContacts.slice(0, CONTACT_PER_TICK)) {
    stats.contactAttempts[leadId] = (stats.contactAttempts[leadId] ?? 0) + 1;

    const outcome = await researchContact({
      leadId,
      campaign: run.campaign,
      runId: run.id,
    });

    if (!outcome.ok) {
      stats.errors.push(`Kontakt ${leadId}: ${outcome.error}`);
      log(stats, `Dohledání kontaktu selhalo: ${outcome.error}`);
      continue;
    }

    stats.contacts += 1;
    log(
      stats,
      outcome.found === 0
        ? "Kontakt se nedohledal, doplní se při schvalování."
        : `Dohledáno ${outcome.found} kontaktů (${outcome.withEmail} s e-mailem).`,
    );
  }

  const remainingContacts = await pendingContactIds(stats, run.campaignId);
  if (remainingContacts.length > 0) {
    await saveRun(runId, stats);
    return {
      id: run.id,
      status: "RUNNING",
      stats,
      pending: remainingContacts.length,
    };
  }

  // Krok 5: návrhy e-mailů. Lead končí ve stavu READY_FOR_REVIEW —
  // odeslání je vždycky na člověku.
  const pendingOutreach = await pendingOutreachIds(stats, run.campaignId);
  for (const leadId of pendingOutreach.slice(0, OUTREACH_PER_TICK)) {
    stats.outreachAttempts[leadId] = (stats.outreachAttempts[leadId] ?? 0) + 1;

    const outcome = await draftOutreach({
      leadId,
      campaign: run.campaign,
      runId: run.id,
      senderName: SENDER_FALLBACK,
    });

    if (!outcome.ok) {
      stats.errors.push(`Outreach ${leadId}: ${outcome.error}`);
      log(stats, `Návrh e-mailu selhal: ${outcome.error}`);
      continue;
    }

    stats.drafts += 1;
    log(stats, `Návrh e-mailu připraven (${outcome.strategy}).`);
  }

  const remainingOutreach = await pendingOutreachIds(stats, run.campaignId);

  if (remainingOutreach.length === 0) {
    log(
      stats,
      `Hotovo: ${stats.qualified} kvalifikovaných, ${stats.audited} auditovaných, ${stats.drafts} návrhů ke schválení, ${stats.rejected} zamítnutých.`,
    );
    await saveRun(runId, stats, { status: "COMPLETED", finishedAt: new Date() });
    return { id: run.id, status: "COMPLETED", stats, pending: 0 };
  }

  await saveRun(runId, stats);
  return {
    id: run.id,
    status: "RUNNING",
    stats,
    pending: remainingOutreach.length,
  };
}

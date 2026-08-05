"use server";

import { SalesCampaignStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { sendGmail } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { isSalesAgent } from "@/lib/sales/agents";
import { auditLead } from "@/lib/sales/auditor";
import { LOST_REASONS } from "@/lib/sales/funnel";
import { refineDraft } from "@/lib/sales/outreach";

export type SalesFormState = { error?: string; success?: string } | undefined;

const optionalText = z
  .string()
  .trim()
  .max(200, "Údaj je příliš dlouhý.")
  .transform((value) => (value === "" ? null : value))
  .nullable();

const CampaignSchema = z.object({
  name: z.string().trim().min(1, "Zadejte název kampaně.").max(120),
  mission: z
    .string()
    .trim()
    .min(1, "Napište misi — co má tým dnes obchodně hledat.")
    .max(4000, "Mise je příliš dlouhá."),
  segment: optionalText,
  geography: optionalText,
  dailyLimit: z
    .number()
    .int()
    .min(1, "Aspoň jedna příležitost denně.")
    .max(50, "Víc než 50 příležitostí denně je spam, ne akvizice."),
  minScore: z
    .number()
    .int()
    .min(0)
    .max(100, "Skóre je v rozsahu 0 až 100."),
  schedule: z.enum(["NONE", "WEEKDAYS", "DAILY"]),
});

function num(formData: FormData, key: string, fallback: number): number {
  const raw = formData.get(key);
  if (typeof raw !== "string" || raw.trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : fallback;
}

function readCampaign(formData: FormData) {
  return {
    name: formData.get("name"),
    mission: formData.get("mission"),
    segment: formData.get("segment"),
    geography: formData.get("geography"),
    dailyLimit: num(formData, "dailyLimit", 8),
    minScore: num(formData, "minScore", 60),
    schedule: ["NONE", "WEEKDAYS", "DAILY"].includes(
      String(formData.get("schedule")),
    )
      ? String(formData.get("schedule"))
      : "NONE",
  };
}

export async function createCampaign(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  await requireUser();

  const parsed = CampaignSchema.safeParse(readCampaign(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const campaign = await prisma.salesCampaign.create({
    data: parsed.data,
    select: { id: true },
  });

  revalidatePath("/sales");
  redirect(`/sales/${campaign.id}`);
}

export async function updateCampaign(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  await requireUser();

  const campaignId = formData.get("campaignId");
  if (typeof campaignId !== "string" || campaignId === "") {
    return { error: "Chybí identifikátor kampaně." };
  }

  const parsed = CampaignSchema.safeParse(readCampaign(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  await prisma.salesCampaign.update({
    where: { id: campaignId },
    data: parsed.data,
  });

  revalidatePath("/sales");
  revalidatePath(`/sales/${campaignId}`);
  return { success: "Kampaň uložena. Změny platí od příštího běhu." };
}

/** Stav kampaně se ukládá hned při přepnutí, jako ostatní stavy v aplikaci. */
export async function setCampaignStatus(formData: FormData) {
  await requireUser();

  const campaignId = formData.get("campaignId");
  const status = formData.get("status");
  if (typeof campaignId !== "string" || campaignId === "") return;

  const validStatus = Object.values(SalesCampaignStatus).find(
    (value) => value === status,
  );
  if (!validStatus) return;

  await prisma.salesCampaign.update({
    where: { id: campaignId },
    data: { status: validStatus },
  });

  revalidatePath("/sales");
  revalidatePath(`/sales/${campaignId}`);
}

/**
 * Uloží novou verzi system promptu agenta a udělá z ní aktivní. Staré verze
 * zůstávají — běhy agentů na ně odkazují a výsledky se podle nich porovnávají.
 */
export async function savePrompt(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const agent = formData.get("agent");
  if (!isSalesAgent(agent)) return { error: "Neznámý agent." };

  const system = String(formData.get("system") ?? "").trim();
  if (system.length < 50) {
    return {
      error: "Prompt je podezřele krátký. Identita agenta potřebuje víc než pár slov.",
    };
  }
  if (system.length > 20_000) {
    return { error: "Prompt je příliš dlouhý." };
  }

  const notes = String(formData.get("notes") ?? "").trim() || null;

  const version = await prisma.$transaction(async (tx) => {
    const last = await tx.salesPromptVersion.findFirst({
      where: { agent },
      orderBy: { version: "desc" },
      select: { version: true, system: true },
    });

    // Uložení beze změny textu nemá vyrábět novou verzi.
    if (last && last.system === system) return null;

    await tx.salesPromptVersion.updateMany({
      where: { agent, active: true },
      data: { active: false },
    });

    const created = await tx.salesPromptVersion.create({
      data: {
        agent,
        version: (last?.version ?? 0) + 1,
        system,
        notes,
        active: true,
        createdById: user.id,
      },
      select: { version: true },
    });

    return created.version;
  });

  revalidatePath("/sales");

  return version === null
    ? { success: "Text se nezměnil, verze zůstává." }
    : { success: `Uloženo jako verze ${version}. Použije se od příštího běhu.` };
}

/**
 * Založí běh kampaně a přesměruje na jeho stránku — ta běh krokuje, dokud
 * neskončí. Souběžný druhý běh téže kampaně se nezakládá.
 */
export async function startRun(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  await requireUser();

  const campaignId = formData.get("campaignId");
  if (typeof campaignId !== "string" || campaignId === "") {
    return { error: "Chybí identifikátor kampaně." };
  }

  if (!isAiConfigured()) {
    return {
      error: "Bez OPENAI_API_KEY agenti neběží. Doplňte klíč do prostředí.",
    };
  }

  const campaign = await prisma.salesCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (!campaign) return { error: "Kampaň nenalezena." };
  if (campaign.status !== "ACTIVE") {
    return { error: "Kampaň není aktivní. Spustit jde jen aktivní kampaň." };
  }

  const running = await prisma.salesRun.findFirst({
    where: { campaignId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (running) {
    // Neotvírat druhý běh, ale dovést uživatele k tomu rozjetému.
    redirect(`/sales/runs/${running.id}`);
  }

  const run = await prisma.salesRun.create({
    data: { campaignId },
    select: { id: true },
  });

  revalidatePath(`/sales/${campaignId}`);
  redirect(`/sales/runs/${run.id}`);
}

const EmailFieldsSchema = z.object({
  to: z.string().trim().pipe(z.email("Zadejte platnou e-mailovou adresu.")),
  subject: z.string().trim().min(1, "Zadejte předmět.").max(150),
  body: z
    .string()
    .trim()
    .min(20, "E-mail je podezřele krátký.")
    .transform((value) => value.replace(/\r\n/g, "\n")),
});

/**
 * Uloží adresáta ke kontaktům firmy. Ručně zadaná adresa při schvalování je
 * nejjistější údaj, jaký máme — přepíše primární kontakt.
 */
async function upsertRecipient(prospectId: string, email: string) {
  const existing = await prisma.salesContact.findFirst({
    where: { prospectId, email },
    select: { id: true, isPrimary: true },
  });

  if (existing) {
    if (!existing.isPrimary) {
      await prisma.salesContact.updateMany({
        where: { prospectId },
        data: { isPrimary: false },
      });
      await prisma.salesContact.update({
        where: { id: existing.id },
        data: { isPrimary: true },
      });
    }
    return;
  }

  await prisma.salesContact.updateMany({
    where: { prospectId },
    data: { isPrimary: false },
  });
  await prisma.salesContact.create({
    data: {
      prospectId,
      email,
      source: "ručně doplněno při schvalování",
      confidence: 1,
      isPrimary: true,
    },
  });
}

async function loadDraft(draftId: string) {
  return prisma.salesEmailDraft.findUnique({
    where: { id: draftId },
    include: {
      lead: { include: { prospect: true } },
    },
  });
}

/** Uloží úpravy návrhu bez odeslání. */
export async function saveEmailDraft(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  await requireUser();

  const draftId = String(formData.get("draftId") ?? "");
  const parsed = EmailFieldsSchema.safeParse({
    to: formData.get("to"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const draft = await loadDraft(draftId);
  if (!draft || draft.status !== "DRAFT") {
    return { error: "Návrh nenalezen, nebo už není rozpracovaný." };
  }

  await prisma.salesEmailDraft.update({
    where: { id: draftId },
    data: { subject: parsed.data.subject, body: parsed.data.body },
  });
  await upsertRecipient(draft.lead.prospectId, parsed.data.to);

  revalidatePath(`/sales/leads/${draft.leadId}`);
  return { success: "Návrh uložen. Nic se neodeslalo." };
}

/**
 * Schválení a odeslání přes Gmail přihlášeného uživatele. Jediné místo,
 * kudy cold e-mail opouští aplikaci — a stojí za ním kliknutí člověka.
 */
export async function approveAndSendEmail(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const draftId = String(formData.get("draftId") ?? "");
  const parsed = EmailFieldsSchema.safeParse({
    to: formData.get("to"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const draft = await loadDraft(draftId);
  if (!draft || draft.status !== "DRAFT") {
    return { error: "Návrh nenalezen, nebo už byl vyřízen." };
  }

  const account = await prisma.googleAccount.findUnique({
    where: { userId: user.id },
    select: { email: true },
  });
  if (!account) {
    return {
      error:
        "Účet není napojený na Gmail — napojte ho v Nastavení, nebo použijte Označit jako odeslaný.",
    };
  }

  const sent = await sendGmail({
    userId: user.id,
    from: account.email,
    fromName: user.name,
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
  });
  if ("error" in sent) return { error: sent.error };

  const now = new Date();
  await prisma.salesEmailDraft.update({
    where: { id: draftId },
    data: {
      subject: parsed.data.subject,
      body: parsed.data.body,
      status: "SENT",
      approvedAt: now,
      sentAt: now,
      approvedById: user.id,
    },
  });
  await upsertRecipient(draft.lead.prospectId, parsed.data.to);
  await prisma.salesLead.update({
    where: { id: draft.leadId },
    data: { status: "CONTACTED" },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: draft.lead.prospectId,
      leadId: draft.leadId,
      actor: "user",
      kind: "sent",
      body: `${user.name} schválil a odeslal e-mail na ${parsed.data.to} (z ${account.email}).`,
    },
  });

  revalidatePath(`/sales/leads/${draft.leadId}`);
  revalidatePath(`/sales/${draft.lead.campaignId}`);
  return { success: `Odesláno na ${parsed.data.to}. Lead je ve stavu Osloven.` };
}

/** Označí e-mail za odeslaný bez odeslání — když odešel jinou cestou. */
export async function markEmailSentManually(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const draftId = String(formData.get("draftId") ?? "");
  const draft = await loadDraft(draftId);
  if (!draft || draft.status !== "DRAFT") {
    return { error: "Návrh nenalezen, nebo už byl vyřízen." };
  }

  const now = new Date();
  await prisma.salesEmailDraft.update({
    where: { id: draftId },
    data: { status: "SENT", approvedAt: now, sentAt: now, approvedById: user.id },
  });
  await prisma.salesLead.update({
    where: { id: draft.leadId },
    data: { status: "CONTACTED" },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: draft.lead.prospectId,
      leadId: draft.leadId,
      actor: "user",
      kind: "sent_manually",
      body: `${user.name} označil e-mail jako odeslaný mimo aplikaci.`,
    },
  });

  revalidatePath(`/sales/leads/${draft.leadId}`);
  revalidatePath(`/sales/${draft.lead.campaignId}`);
  return { success: "Označeno jako odeslané. Příležitost je ve stavu Oslovená." };
}

/** Zamítnutí leadu při review. Důvod se ukládá — Coach z něj bude jednou žít. */
export async function rejectLead(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, prospectId: true, campaignId: true, status: true },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (lead.status === "CONTACTED") {
    return { error: "Oslovenou příležitost už nejde zamítnout." };
  }

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: "REJECTED", lostReason: reason || "zamítnuto při review" },
  });
  await prisma.salesEmailDraft.updateMany({
    where: { leadId, status: "DRAFT" },
    data: { status: "REJECTED" },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "rejected",
      body: `${user.name} lead zamítl${reason ? `: ${reason}` : "."}`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  return { success: "Příležitost zamítnuta. Firma je půl roku v cooldownu." };
}

/**
 * Znovuotevření zamítnuté příležitosti. Vrací ji do nejzazšího stavu, který
 * odpovídá tomu, co už má hotové: s návrhem e-mailu zpět ke schválení
 * (návrh ožije), s auditem mezi kvalifikované, jinak mezi objevené.
 * Otevřením končí i cooldown — firma přestává být blokovaná pro dedup.
 */
export async function reopenLead(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: {
      emails: { orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { audits: true } },
    },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (lead.status !== "REJECTED") {
    return { error: "Znovu otevřít jde jen zamítnutá příležitost." };
  }

  const draft = lead.emails[0] ?? null;
  const nextStatus = draft
    ? "READY_FOR_REVIEW"
    : lead._count.audits > 0
      ? "QUALIFIED"
      : "DISCOVERED";

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: nextStatus, lostReason: null },
  });
  if (draft && draft.status === "REJECTED") {
    await prisma.salesEmailDraft.update({
      where: { id: draft.id },
      data: { status: "DRAFT" },
    });
  }
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "reopened",
      body: `${user.name} příležitost znovu otevřel.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  return {
    success:
      nextStatus === "READY_FOR_REVIEW"
        ? "Příležitost je zpět ke schválení, návrh e-mailu ožil."
        : "Příležitost je znovu otevřená.",
  };
}

/**
 * Přepsání návrhu e-mailu AI podle pokynu uživatele. Návrh zůstává ve stavu
 * DRAFT — o odeslání pořád rozhoduje člověk tlačítkem.
 */
export async function refineEmailDraft(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();
  if (!isAiConfigured()) {
    return { error: "Chybí OPENAI_API_KEY, úprava AI nejde spustit." };
  }

  const draftId = String(formData.get("draftId") ?? "");
  const leadId = String(formData.get("leadId") ?? "");
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (instruction.length < 5) {
    return { error: "Napište, co má AI na e-mailu změnit." };
  }
  if (instruction.length > 500) {
    return { error: "Pokyn je příliš dlouhý." };
  }

  const outcome = await refineDraft({
    draftId,
    instruction,
    userName: user.name,
  });
  if (!outcome.ok) return { error: outcome.error };

  if (leadId) revalidatePath(`/sales/leads/${leadId}`);
  return { success: "E-mail upraven podle pokynu. Zkontrolujte ho níž." };
}

/** Stavy, ve kterých dává smysl web přeauditovat — před oslovením. */
const REAUDIT_STATUSES = new Set([
  "QUALIFIED",
  "RESEARCHING",
  "READY_FOR_REVIEW",
  "APPROVED",
]);

/**
 * Ruční přeaudit z detailu příležitosti. Pořídí čerstvé screenshoty, spustí
 * multimodální audit a přepíše skóre. Když nové skóre spadne pod práh
 * kampaně, příležitost se rovnou zamítne a rozepsané návrhy zahodí —
 * stejné pravidlo jako při kvalifikaci.
 */
export async function reauditLead(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();
  if (!isAiConfigured()) {
    return { error: "Chybí OPENAI_API_KEY, audit nejde spustit." };
  }

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: { campaign: true },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (!REAUDIT_STATUSES.has(lead.status)) {
    return { error: "V tomto stavu už web přeauditovat nejde." };
  }

  const outcome = await auditLead({
    leadId,
    campaign: lead.campaign,
    runId: null,
  });
  if (!outcome.ok) return { error: outcome.error };

  if (outcome.finalScore < lead.campaign.minScore) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: {
        status: "REJECTED",
        lostReason: `skóre ${outcome.finalScore} pod prahem ${lead.campaign.minScore} po přeauditu`,
      },
    });
    await prisma.salesEmailDraft.updateMany({
      where: { leadId, status: "DRAFT" },
      data: { status: "REJECTED" },
    });
    await prisma.salesActivity.create({
      data: {
        prospectId: lead.prospectId,
        leadId,
        actor: "user",
        kind: "rejected",
        body: `${user.name} nechal web přeauditovat — skóre ${outcome.finalScore} je pod prahem, příležitost zamítnuta.`,
      },
    });
    revalidatePath(`/sales/leads/${leadId}`);
    revalidatePath(`/sales/${lead.campaignId}`);
    return {
      success: `Nové skóre ${outcome.finalScore} je pod prahem kampaně — příležitost zamítnuta.`,
    };
  }

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  return { success: `Audit hotový, nové skóre ${outcome.finalScore}.` };
}

/** Stavy, které smí uživatel nastavit ručně po oslovení (sekce 29 specky). */
const MANUAL_OUTCOMES = new Set([
  "REPLIED",
  "MEETING",
  "PROPOSAL",
  "WON",
  "LOST",
]);

/** Ze kterých stavů se outcome smí měnit. */
const OUTCOME_SOURCE = new Set([
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "PROPOSAL",
]);

const OUTCOME_LABELS: Record<string, string> = {
  REPLIED: "Odpověděl",
  MEETING: "Domluvená schůzka",
  PROPOSAL: "Poslaná nabídka",
  WON: "Vyhráno",
  LOST: "Prohráno",
};

/**
 * Ruční posun leadu po oslovení: odpověď, schůzka, nabídka, výhra, prohra.
 * Každý lead má skončit výsledkem — z outcomes bude jednou žít Coach.
 */
export async function setLeadOutcome(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const lostReason = String(formData.get("lostReason") ?? "").trim();

  if (!MANUAL_OUTCOMES.has(outcome)) return { error: "Neznámý výsledek." };

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, prospectId: true, campaignId: true, status: true },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (!OUTCOME_SOURCE.has(lead.status)) {
    return { error: "Výsledek jde nastavit až po oslovení." };
  }

  if (outcome === "LOST" && lostReason === "") {
    return { error: "U prohry vyberte důvod — bez něj se z ní nejde poučit." };
  }
  if (
    outcome === "LOST" &&
    !(LOST_REASONS as readonly string[]).includes(lostReason)
  ) {
    return { error: "Neznámý důvod prohry." };
  }

  await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      status: outcome as never,
      lostReason: outcome === "LOST" ? lostReason : null,
    },
  });

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "outcome",
      body: `${user.name}: ${OUTCOME_LABELS[outcome]}${outcome === "LOST" ? ` — ${lostReason}` : "."}`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);

  return {
    success:
      outcome === "WON"
        ? "Vyhráno. Založte klienta a zakázku, ať se pokračuje v dodací části."
        : `Stav změněn: ${OUTCOME_LABELS[outcome]}.`,
  };
}

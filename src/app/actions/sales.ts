"use server";

import { Prisma, SalesCampaignStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { sendGmail } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { isSalesAgent } from "@/lib/sales/agents";
import { auditLead } from "@/lib/sales/auditor";
import { lookupClientDetails } from "@/lib/sales/client-details";
import { canRescan, canUndoSend, LOST_REASONS } from "@/lib/sales/funnel";
import { gradeFor } from "@/lib/sales/human-grades";
import { MAX_INSTRUCTION_CHARS } from "@/lib/sales/outreach-input";
import { refineDraft } from "@/lib/sales/outreach";

import { createProjectWithPhases } from "./projects";

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
 * Uklidí to, co má proskenování udělat znovu: audit se maže (screenshoty se
 * stejně přepisují na stejné klíče), rozepsaný návrh jde mezi zamítnuté,
 * research i koncept homepage se zahodí. `mockupVariant` zůstává — vylosovaná
 * varianta experimentu se nesmí měnit, jinak by měření nic neřeklo.
 */
async function resetLeadForRescan(leadId: string): Promise<void> {
  await prisma.salesAudit.deleteMany({ where: { leadId } });
  await prisma.salesEmailDraft.updateMany({
    where: { leadId, status: "DRAFT" },
    data: { status: "REJECTED" },
  });
  await prisma.salesLead.update({
    where: { id: leadId },
    data: {
      // Kvalifikace se znovu nepouští: když člověk řekne „tuhle chci“,
      // nesmí ji práh kampaně vyhodit podruhé.
      status: "QUALIFIED",
      lostReason: null,
      // Json sloupec se maže DbNull, `null` by Prisma brala jako JSON null.
      research: Prisma.DbNull,
      researchAt: null,
      mockupKey: null,
      mockupAt: null,
    },
  });
}

/**
 * Běh, který proskenování odpracuje. Fáze po kvalifikaci se dívají na celou
 * kampaň, takže rozjetý běh práci převezme sám; jinak se založí nový
 * s přeskočeným hledáním kandidátů — nové firmy hledat nechceme.
 */
async function ensureRescanRun(campaignId: string): Promise<string> {
  const running = await prisma.salesRun.findFirst({
    where: { campaignId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });
  if (running) return running.id;

  const run = await prisma.salesRun.create({
    data: { campaignId, stats: { discovered: true } },
    select: { id: true },
  });
  return run.id;
}

/**
 * Kompletní proskenování jedné příležitosti: audit se snímky, kontakty,
 * research, koncept homepage a nový návrh e-mailu. Práci odpracuje běh
 * kampaně, takže se stránka přesměruje na něj — tam je vidět postup.
 */
export async function rescanLead(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();
  if (!isAiConfigured()) {
    return { error: "Bez OPENAI_API_KEY agenti neběží. Doplňte klíč do prostředí." };
  }

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, prospectId: true, campaignId: true, status: true },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (!canRescan(lead.status)) {
    return {
      error: "Proskenovat znovu jde jen příležitost, které jsme ještě nenapsali.",
    };
  }

  await resetLeadForRescan(leadId);
  const runId = await ensureRescanRun(lead.campaignId);

  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "rescan",
      body: `${user.name} pustil kompletní proskenování — audit webu, kontakty, research i nový návrh e-mailu. Práh kampaně se u téhle příležitosti neuplatní.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  revalidatePath("/sales");
  redirect(`/sales/runs/${runId}`);
}

/**
 * Vezme zpět „e-mail odešel“: odeslaný návrh se vrátí ke schválení. Skutečně
 * odeslanou zprávu to neodvolá — jen náš stav, a text to říká nahlas.
 */
export async function undoEmailSent(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      prospectId: true,
      campaignId: true,
      status: true,
      emails: {
        where: { status: "SENT" },
        orderBy: { sentAt: "desc" },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (!canUndoSend(lead.status)) {
    return {
      error:
        "Vzít odeslání zpět jde jen u čerstvě oslovené příležitosti. Nejdřív vraťte výsledek na „Oslovená“.",
    };
  }

  const sent = lead.emails[0] ?? null;
  if (!sent) {
    return { error: "Nenašel jsem odeslaný e-mail, který by šlo vzít zpět." };
  }

  await prisma.salesEmailDraft.update({
    where: { id: sent.id },
    data: {
      status: "DRAFT",
      sentAt: null,
      approvedAt: null,
      approvedById: null,
    },
  });
  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: "READY_FOR_REVIEW" },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "undo_sent",
      body: `${user.name} vzal odeslání zpět — návrh je znovu ke schválení. Pokud e-mail skutečně odešel, adresát ho má.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  revalidatePath("/sales");
  return {
    success:
      "Odeslání vzato zpět, návrh je zpět ke schválení. Pokud e-mail opravdu odešel, adresát ho ale má.",
  };
}

/**
 * Znovuotevření zamítnuté nebo prohrané příležitosti. Zamítnutá se s návrhem
 * e-mailu vrací ke schválení (návrh ožije); bez návrhu není co schvalovat,
 * takže se rovnou pustí kompletní proskenování — jinak by zůstala trčet mezi
 * objevenými, kde ji žádný běh nikdy nevezme.
 * Prohraná se vrací mezi oslovené — e-mail už odešel.
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
  if (lead.status !== "REJECTED" && lead.status !== "LOST") {
    return {
      error: "Znovu otevřít jde jen zamítnutá nebo prohraná příležitost.",
    };
  }

  if (lead.status === "LOST") {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { status: "CONTACTED", lostReason: null },
    });
    await prisma.salesActivity.create({
      data: {
        prospectId: lead.prospectId,
        leadId,
        actor: "user",
        kind: "reopened",
        body: `${user.name} prohranou příležitost znovu otevřel — zpět mezi oslovené.`,
      },
    });
    revalidatePath(`/sales/leads/${leadId}`);
    revalidatePath(`/sales/${lead.campaignId}`);
    return { success: "Příležitost je zpět mezi oslovenými." };
  }

  const draft = lead.emails[0] ?? null;
  const revivable =
    draft && (draft.status === "DRAFT" || draft.status === "REJECTED")
      ? draft
      : null;

  if (revivable) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: { status: "READY_FOR_REVIEW", lostReason: null },
    });
    if (revivable.status === "REJECTED") {
      await prisma.salesEmailDraft.update({
        where: { id: revivable.id },
        data: { status: "DRAFT" },
      });
    }
    await prisma.salesActivity.create({
      data: {
        prospectId: lead.prospectId,
        leadId,
        actor: "user",
        kind: "reopened",
        body: `${user.name} příležitost znovu otevřel — návrh e-mailu ožil a je ke schválení.`,
      },
    });

    revalidatePath(`/sales/leads/${leadId}`);
    revalidatePath(`/sales/${lead.campaignId}`);
    revalidatePath("/sales");
    return { success: "Příležitost je zpět ke schválení, návrh e-mailu ožil." };
  }

  // Bez klíče nemáme čím skenovat — příležitost aspoň otevřeme, ať se s ní
  // dá pracovat ručně, a napíšeme proč se nic dalšího nestalo.
  if (!isAiConfigured()) {
    await prisma.salesLead.update({
      where: { id: leadId },
      data: {
        status: lead._count.audits > 0 ? "QUALIFIED" : "DISCOVERED",
        lostReason: null,
      },
    });
    await prisma.salesActivity.create({
      data: {
        prospectId: lead.prospectId,
        leadId,
        actor: "user",
        kind: "reopened",
        body: `${user.name} příležitost znovu otevřel. Bez OPENAI_API_KEY ji nejde proskenovat, návrh e-mailu tedy nevznikne.`,
      },
    });
    revalidatePath(`/sales/leads/${leadId}`);
    revalidatePath(`/sales/${lead.campaignId}`);
    return {
      error:
        "Příležitost je otevřená, ale bez OPENAI_API_KEY ji nemám čím proskenovat.",
    };
  }

  await resetLeadForRescan(leadId);
  const runId = await ensureRescanRun(lead.campaignId);
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "reopened",
      body: `${user.name} příležitost znovu otevřel — spustilo se kompletní proskenování, po dokončení bude Ke schválení. Práh kampaně se u ní už neuplatní.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  revalidatePath("/sales");
  redirect(`/sales/runs/${runId}`);
}

/**
 * Vaše hodnocení webu (0–100) — ukládá se k příležitosti a slouží jako
 * kalibrační vzor: příští audity dostanou vaše ohodnocené snímky napříč
 * škálou, aby model srovnal laťku s člověkem, který weby staví.
 * Nepovinná poznámka jde modelu s sebou — „proč“ učí víc než číslo.
 */
export async function rateWebsite(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const score = Number(formData.get("score"));
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return { error: "Hodnocení je číslo 0 až 100." };
  }
  const rawNote = String(formData.get("note") ?? "").trim();
  if (rawNote.length > 200) return { error: "Poznámka je příliš dlouhá." };

  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      prospectId: true,
      campaignId: true,
      websiteScore: true,
      humanWebNote: true,
    },
  });
  if (!lead) return { error: "Příležitost nenalezena." };

  // Pole poznámky je předvyplněné tím, co je uložené, takže se ukládá přesně
  // to, co v něm zůstalo — vymazání pole poznámku smaže.
  const note = rawNote === "" ? null : rawNote;

  await prisma.salesLead.update({
    where: { id: leadId },
    // Uložení hodnocení ho zároveň zapíná: kdo dává známku, chce ji používat.
    data: { humanWebScore: score, humanWebNote: note, humanWebActive: true },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "rated",
      body: `${user.name} ohodnotil web ${score}/100 (${gradeFor(score).label})${lead.websiteScore !== null ? `, model dal ${lead.websiteScore}` : ""}${rawNote ? ` — „${rawNote}“` : ""}. Použije se pro kalibraci příštích auditů.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath("/settings");
  return {
    success: `Uloženo: ${gradeFor(score).label} (${score}/100). Příští audity se podle vás srovnají.`,
  };
}

const SampleSchema = z.object({
  label: z.string().trim().min(1, "Pojmenujte vzor.").max(80),
  subject: z
    .string()
    .trim()
    .max(150, "Předmět je příliš dlouhý.")
    .transform((value) => (value === "" ? null : value)),
  body: z
    .string()
    .trim()
    .min(80, "Vzor je příliš krátký — vložte celý e-mail, ne jen věty.")
    .max(4000, "Vzor je příliš dlouhý."),
  note: z
    .string()
    .trim()
    .max(300, "Poznámka je příliš dlouhá.")
    .transform((value) => (value === "" ? null : value)),
});

function readSample(formData: FormData) {
  return {
    label: formData.get("label"),
    subject: formData.get("subject") ?? "",
    body: formData.get("body"),
    note: formData.get("note") ?? "",
  };
}

/**
 * Vzorový e-mail: takhle má Outreach psát. K modelu jde jako ukázka tónu
 * a stavby — fakta si z něj brát nesmí, vzor je o jiné firmě.
 */
export async function saveEmailSample(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const parsed = SampleSchema.safeParse(readSample(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const sampleId = String(formData.get("sampleId") ?? "");
  if (sampleId !== "") {
    await prisma.salesEmailSample.update({
      where: { id: sampleId },
      data: parsed.data,
    });
    return { success: "Vzor uložen. Použije se u příštího návrhu e-mailu." };
  }

  await prisma.salesEmailSample.create({
    data: { ...parsed.data, createdById: user.id },
  });
  revalidatePath("/settings");
  return { success: "Vzor přidán. Použije se u příštího návrhu e-mailu." };
}

/** Vypnutý vzor zůstává uložený, jen k modelu nejde. */
export async function toggleEmailSample(formData: FormData) {
  await requireUser();

  const sampleId = String(formData.get("sampleId") ?? "");
  const sample = await prisma.salesEmailSample.findUnique({
    where: { id: sampleId },
    select: { active: true },
  });
  if (!sample) return;

  await prisma.salesEmailSample.update({
    where: { id: sampleId },
    data: { active: !sample.active },
  });
  revalidatePath("/settings");
}

export async function deleteEmailSample(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  await requireUser();

  const sampleId = String(formData.get("sampleId") ?? "");
  const sample = await prisma.salesEmailSample.findUnique({
    where: { id: sampleId },
    select: { id: true },
  });
  if (!sample) return { error: "Vzor nenalezen." };

  await prisma.salesEmailSample.delete({ where: { id: sampleId } });
  revalidatePath("/settings");
  return { success: "Vzor smazán." };
}

/**
 * Vezme zpět výhru — příležitost se vrátí mezi oslovené a odpojí se od
 * klienta. Založeného klienta ani zakázku NEMAŽE: může na nich už být práce
 * a mazat cizí data kvůli jednomu překliku by bylo horší než překlik sám.
 * Zpráva i timeline říkají, že zůstávají a kde je případně smazat.
 */
export async function undoWon(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      prospectId: true,
      campaignId: true,
      status: true,
      clientId: true,
      client: { select: { companyName: true } },
    },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (lead.status !== "WON") {
    return { error: "Vzít zpět jde jen vyhraná příležitost." };
  }

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: "CONTACTED", clientId: null },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "outcome",
      body: `${user.name} vzal výhru zpět — příležitost je zpět na Oslovená.${
        lead.client
          ? ` Klient „${lead.client.companyName}“ i jeho zakázka zůstávají v Zakázkách, případně je smažte tam.`
          : ""
      }`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  revalidatePath("/sales");
  revalidatePath("/projects");
  return {
    success: lead.client
      ? `Výhra vzata zpět. Klient „${lead.client.companyName}“ a jeho zakázka zůstávají založené — smazat je jde v Zakázkách.`
      : "Výhra vzata zpět, příležitost je mezi oslovenými.",
  };
}

/** Vypnutý vzor zůstává uložený, jen ho audit nedostane. */
export async function toggleWebsiteRating(formData: FormData) {
  await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { humanWebScore: true, humanWebActive: true },
  });
  if (!lead || lead.humanWebScore === null) return;

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { humanWebActive: !lead.humanWebActive },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath("/settings");
}

/** Odebrání hodnocení ze sbírky vzorů — omyl nemá kalibrovat další audity. */
export async function clearWebsiteRating(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    select: { id: true, prospectId: true, humanWebScore: true },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (lead.humanWebScore === null) return { error: "Tenhle web hodnocený není." };

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { humanWebScore: null, humanWebNote: null, humanWebActive: true },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "rated",
      body: `${user.name} odebral své hodnocení webu (bylo ${lead.humanWebScore}/100). Ze vzorů pro kalibraci vypadl.`,
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath("/settings");
  return { success: "Hodnocení odebráno, web už kalibraci neovlivňuje." };
}

/**
 * Výhra jedním tlačítkem: založí klienta i zakázku ze všeho, co o firmě
 * víme (prospect, dohledané kontakty, doména), a chybějící fakturační
 * údaje (IČO, sídlo) zkusí dohledat AI v rejstřících. Lead končí ve stavu
 * WON s prolinkem na klienta.
 */
export async function foundProjectFromLead(
  _prevState: SalesFormState,
  formData: FormData,
): Promise<SalesFormState> {
  const user = await requireUser();

  const leadId = String(formData.get("leadId") ?? "");
  const lead = await prisma.salesLead.findUnique({
    where: { id: leadId },
    include: {
      prospect: { include: { contacts: { orderBy: { isPrimary: "desc" } } } },
      campaign: { select: { id: true, name: true } },
    },
  });
  if (!lead) return { error: "Příležitost nenalezena." };
  if (!OUTCOME_SOURCE.has(lead.status)) {
    return { error: "Zakázka se zakládá až po oslovení firmy." };
  }
  if (lead.clientId) {
    return { error: "Z této příležitosti už zakázka existuje." };
  }

  // Fakturační údaje v prospektu nejsou — AI je zkusí dohledat v ARES.
  // Když se to nepovede, zakázka vznikne i tak a údaje se doplní ručně.
  const details = isAiConfigured()
    ? await lookupClientDetails({
        companyName: lead.prospect.name,
        location: lead.prospect.location,
        domain: lead.prospect.domain,
        campaignId: lead.campaignId,
        leadId,
      })
    : null;

  const primaryContact =
    lead.prospect.contacts.find((contact) => contact.isPrimary) ??
    lead.prospect.contacts.find((contact) => contact.email) ??
    lead.prospect.contacts[0] ??
    null;

  const client = await prisma.client.create({
    data: {
      companyName: lead.prospect.name,
      contactPerson: primaryContact?.name ?? null,
      email: primaryContact?.email ?? null,
      phone: primaryContact?.phone ?? null,
      website: lead.prospect.domain ? `https://${lead.prospect.domain}` : null,
      ico: details?.ico ?? null,
      address: details?.address ?? null,
      internalNote: [
        `Založeno z AI Sales — kampaň „${lead.campaign.name}“.`,
        lead.reason ? `Proč jsme firmu oslovili: ${lead.reason}` : null,
        details?.ico || details?.address
          ? "IČO a sídlo dohledala AI — před smlouvou zkontrolujte."
          : "IČO a sídlo se nepodařilo dohledat — doplňte před smlouvou.",
      ]
        .filter(Boolean)
        .join("\n"),
      status: "ACTIVE",
    },
    select: { id: true },
  });

  await createProjectWithPhases(client.id, `Nový web — ${lead.prospect.name}`);

  await prisma.salesLead.update({
    where: { id: leadId },
    data: { status: "WON", clientId: client.id, lostReason: null },
  });
  await prisma.salesActivity.create({
    data: {
      prospectId: lead.prospectId,
      leadId,
      actor: "user",
      kind: "won",
      body: `${user.name} vyhrál příležitost a založil zakázku.`,
      meta: { clientId: client.id },
    },
  });

  revalidatePath(`/sales/leads/${leadId}`);
  revalidatePath(`/sales/${lead.campaignId}`);
  revalidatePath("/projects");
  redirect(`/clients/${client.id}`);
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
  if (instruction.length > MAX_INSTRUCTION_CHARS) {
    return {
      error: `Pokyn je příliš dlouhý — vejde se ${MAX_INSTRUCTION_CHARS} znaků, tedy asi tisíc slov.`,
    };
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
  "CONTACTED",
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
  CONTACTED: "Vráceno na Oslovená",
  REPLIED: "Odpověděli",
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

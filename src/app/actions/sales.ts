"use server";

import { SalesCampaignStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSalesAgent } from "@/lib/sales/agents";

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
    .min(1, "Aspoň jeden lead denně.")
    .max(50, "Víc než 50 leadů denně je spam, ne akvizice."),
  minScore: z
    .number()
    .int()
    .min(0)
    .max(100, "Skóre je v rozsahu 0 až 100."),
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

"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Předloha fází a jejich úkolů. Slouží jen k předvyplnění nové zakázky —
 * úpravy se do rozjetých zakázek nepropisují, ty mají fáze vlastní.
 */
export async function createPhaseTemplate(formData: FormData) {
  await requireUser();

  const name = formData.get("name");
  if (typeof name !== "string" || name.trim() === "") return;

  const last = await prisma.phaseTemplate.findFirst({
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.phaseTemplate.create({
    data: { name: name.trim(), position: (last?.position ?? -1) + 1 },
  });

  revalidatePath("/settings");
}

export async function renamePhaseTemplate(formData: FormData) {
  await requireUser();

  const templateId = formData.get("templateId");
  const name = formData.get("name");
  if (typeof templateId !== "string" || typeof name !== "string") return;
  if (name.trim() === "") return;

  await prisma.phaseTemplate.update({
    where: { id: templateId },
    data: { name: name.trim() },
  });

  revalidatePath("/settings");
}

export async function deletePhaseTemplate(formData: FormData) {
  await requireUser();

  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return;

  await prisma.phaseTemplate.deleteMany({ where: { id: templateId } });

  // Pozice srovnáme, aby v nich nezůstaly díry.
  const remaining = await prisma.phaseTemplate.findMany({
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (const [index, item] of remaining.entries()) {
    await prisma.phaseTemplate.update({
      where: { id: item.id },
      data: { position: index },
    });
  }

  revalidatePath("/settings");
}

export async function createTaskTemplate(formData: FormData) {
  await requireUser();

  const phaseTemplateId = formData.get("phaseTemplateId");
  const title = formData.get("title");
  if (typeof phaseTemplateId !== "string" || typeof title !== "string") return;
  if (title.trim() === "") return;

  const last = await prisma.taskTemplate.findFirst({
    where: { phaseTemplateId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.taskTemplate.create({
    data: {
      phaseTemplateId,
      title: title.trim(),
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath("/settings");
}

export async function deleteTaskTemplate(formData: FormData) {
  await requireUser();

  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return;

  await prisma.taskTemplate.deleteMany({ where: { id: templateId } });

  revalidatePath("/settings");
}

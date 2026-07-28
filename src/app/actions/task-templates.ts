"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { PHASE_ORDER } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export async function createTaskTemplate(formData: FormData) {
  await requireUser();

  const title = formData.get("title");
  const phaseValue = formData.get("phase");

  if (typeof title !== "string" || title.trim() === "") return;
  const phase = PHASE_ORDER.find((value) => value === phaseValue);
  if (!phase) return;

  const last = await prisma.taskTemplate.findFirst({
    where: { phase },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.taskTemplate.create({
    data: { title: title.trim(), phase, position: (last?.position ?? -1) + 1 },
  });

  revalidatePath("/settings");
}

/**
 * Šablona se kopíruje do úkolů při zakládání zakázky, takže smazání položky
 * nijak neovlivní zakázky, které už existují.
 */
export async function deleteTaskTemplate(formData: FormData) {
  await requireUser();

  const templateId = formData.get("templateId");
  if (typeof templateId !== "string") return;

  await prisma.taskTemplate.deleteMany({ where: { id: templateId } });

  revalidatePath("/settings");
}

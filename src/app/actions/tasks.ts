"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { PHASE_ORDER } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

async function clientIdForProject(projectId: string): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  return project?.clientId ?? null;
}

export async function createTask(formData: FormData) {
  await requireUser();

  const projectId = formData.get("projectId");
  const title = formData.get("title");
  const phaseValue = formData.get("phase");

  if (typeof projectId !== "string" || typeof title !== "string") return;
  if (title.trim() === "") return;

  const phase = PHASE_ORDER.find((value) => value === phaseValue);
  if (!phase) return;

  const last = await prisma.task.findFirst({
    where: { projectId, phase },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      projectId,
      title: title.trim(),
      phase,
      position: (last?.position ?? -1) + 1,
    },
  });

  const clientId = await clientIdForProject(projectId);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
}

export async function toggleTask(formData: FormData) {
  await requireUser();

  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { done: true, projectId: true },
  });
  if (!task) return;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      done: !task.done,
      doneAt: task.done ? null : new Date(),
    },
  });

  const clientId = await clientIdForProject(task.projectId);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
}

export async function deleteTask(formData: FormData) {
  await requireUser();

  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });

  const clientId = await clientIdForProject(task.projectId);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
}

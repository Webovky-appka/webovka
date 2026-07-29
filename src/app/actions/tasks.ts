"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type TaskFormState = { error?: string } | undefined;

async function clientIdForTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { clientId: true } } },
  });
  return task?.project.clientId ?? null;
}

export async function createTask(formData: FormData) {
  await requireUser();

  const phaseId = formData.get("phaseId");
  const title = formData.get("title");

  if (typeof phaseId !== "string" || typeof title !== "string") return;
  if (title.trim() === "") return;

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    select: { projectId: true, project: { select: { clientId: true } } },
  });
  if (!phase) return;

  const last = await prisma.task.findFirst({
    where: { phaseId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  await prisma.task.create({
    data: {
      projectId: phase.projectId,
      phaseId,
      title: title.trim(),
      position: (last?.position ?? -1) + 1,
    },
  });

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");
}

export async function updateTask(
  _prevState: TaskFormState,
  formData: FormData,
): Promise<TaskFormState> {
  await requireUser();

  const taskId = formData.get("taskId");
  const title = formData.get("title");
  const description = formData.get("description");
  const dueDate = formData.get("dueDate");
  const phaseId = formData.get("phaseId");

  if (typeof taskId !== "string" || taskId === "") {
    return { error: "Chybí identifikátor úkolu." };
  }
  if (typeof title !== "string" || title.trim() === "") {
    return { error: "Název úkolu nesmí být prázdný." };
  }
  if (typeof phaseId !== "string" || phaseId === "") {
    return { error: "Chybí fáze." };
  }

  let parsedDueDate: Date | null = null;
  if (typeof dueDate === "string" && dueDate.trim() !== "") {
    parsedDueDate = new Date(dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return { error: "Neplatné datum." };
    }
  }

  // Fáze musí patřit té samé zakázce, jinak by úkol přeskočil k jinému klientovi.
  const [task, phase] = await Promise.all([
    prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    }),
    prisma.projectPhase.findUnique({
      where: { id: phaseId },
      select: { projectId: true, project: { select: { clientId: true } } },
    }),
  ]);
  if (!task || !phase) return { error: "Úkol nebo fáze neexistuje." };
  if (task.projectId !== phase.projectId) {
    return { error: "Fáze patří jiné zakázce." };
  }

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title: title.trim(),
      description:
        typeof description === "string" && description.trim() !== ""
          ? description.trim()
          : null,
      dueDate: parsedDueDate,
      phaseId,
    },
  });

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");

  // Po uložení panel zavřeme, ať se uživatel nemusí vracet sám.
  const closeHref = formData.get("closeHref");
  if (typeof closeHref === "string" && closeHref.startsWith("/")) {
    redirect(closeHref);
  }

  return undefined;
}

export async function toggleTask(formData: FormData) {
  await requireUser();

  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { done: true },
  });
  if (!task) return;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      done: !task.done,
      doneAt: task.done ? null : new Date(),
    },
  });

  const clientId = await clientIdForTask(taskId);
  if (clientId) revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
}

export async function deleteTask(formData: FormData) {
  await requireUser();

  const taskId = formData.get("taskId");
  if (typeof taskId !== "string") return;

  const clientId = await clientIdForTask(taskId);
  if (!clientId) return;

  await prisma.task.delete({ where: { id: taskId } });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
}

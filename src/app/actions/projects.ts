"use server";

import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { logSystemEvent } from "@/lib/events";
import { notifyClientPhaseChanged } from "@/lib/notifications";
import { DEFAULT_PHASES, activePhase } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export type ProjectFormState = { error?: string } | undefined;

const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .refine(
    (value) => value === null || /^https?:\/\//.test(value),
    "Odkaz musí začínat http:// nebo https://",
  );

const PortalSchema = z.object({
  portalNote: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  previewUrl: optionalUrl,
});

/**
 * Fáze nové zakázky. Vezmou se z předlohy, a když žádná není, z výchozích
 * názvů — zakázka nikdy nezůstane bez fází, protože bez nich nejde zadat úkol.
 */
async function phasesForNewProject() {
  const templates = await prisma.phaseTemplate.findMany({
    orderBy: { position: "asc" },
    include: { tasks: { orderBy: { position: "asc" } } },
  });

  if (templates.length > 0) {
    return templates.map((template, index) => ({
      name: template.name,
      position: index,
      tasks: template.tasks.map((task, taskIndex) => ({
        title: task.title,
        position: taskIndex,
      })),
    }));
  }

  return DEFAULT_PHASES.map((phase, index) => ({
    name: phase.name,
    position: index,
    tasks: phase.tasks.map((title, taskIndex) => ({
      title,
      position: taskIndex,
    })),
  }));
}

/** Vytvoří zakázku i s fázemi a úkoly. Používá to i zakládání klienta. */
export async function createProjectWithPhases(
  clientId: string,
  name: string,
): Promise<string> {
  const phases = await phasesForNewProject();

  const project = await prisma.project.create({
    data: { clientId, name },
    select: { id: true },
  });

  for (const phase of phases) {
    await prisma.projectPhase.create({
      data: {
        projectId: project.id,
        name: phase.name,
        position: phase.position,
        tasks: {
          create: phase.tasks.map((task) => ({
            projectId: project.id,
            title: task.title,
            position: task.position,
          })),
        },
      },
    });
  }

  return project.id;
}

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireUser();

  const clientId = formData.get("clientId");
  const name = formData.get("name");

  if (typeof clientId !== "string" || clientId === "") {
    return { error: "Chybí identifikátor klienta." };
  }
  if (typeof name !== "string" || name.trim() === "") {
    return { error: "Zadejte název zakázky." };
  }

  await createProjectWithPhases(clientId, name.trim());

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
  return undefined;
}

/**
 * Ukončí fázi. Jediná akce, která posouvá zakázku dál — přepínání fází v UI je
 * jen prohlížení a do komunikace se nezapisuje.
 */
export async function completePhase(formData: FormData) {
  const user = await requireUser();

  const phaseId = formData.get("phaseId");
  if (typeof phaseId !== "string") return;

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    include: {
      project: {
        select: {
          id: true,
          clientId: true,
          name: true,
          portalNote: true,
          client: { select: { email: true } },
          phases: {
            select: { id: true, name: true, position: true, completedAt: true },
          },
        },
      },
    },
  });
  if (!phase || phase.completedAt !== null) return;

  const completedAt = new Date();
  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { completedAt, completedById: user.id },
  });

  const afterCompletion = phase.project.phases.map((item) =>
    item.id === phaseId ? { ...item, completedAt } : item,
  );
  const next = activePhase(afterCompletion);
  const finished = next === null || next.id === phaseId;

  await logSystemEvent({
    clientId: phase.project.clientId,
    projectId: phase.project.id,
    body: finished
      ? `${user.name} ukončil fázi „${phase.name}“. Zakázka je hotová.`
      : `${user.name} ukončil fázi „${phase.name}“. Zakázka pokračuje fází „${next.name}“.`,
  });

  if (!finished) {
    await notifyClientPhaseChanged({
      clientEmail: phase.project.client.email,
      projectName: phase.project.name,
      phaseName: next.name,
      portalNote: phase.project.portalNote,
    });
  }

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");
}

/** Vrátí ukončenou fázi zpět do práce. Klientovi se to neposílá, je to korekce. */
export async function reopenPhase(formData: FormData) {
  const user = await requireUser();

  const phaseId = formData.get("phaseId");
  if (typeof phaseId !== "string") return;

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    select: {
      name: true,
      project: { select: { id: true, clientId: true } },
    },
  });
  if (!phase) return;

  await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { completedAt: null, completedById: null },
  });

  await logSystemEvent({
    clientId: phase.project.clientId,
    projectId: phase.project.id,
    body: `${user.name} vrátil fázi „${phase.name}“ zpět do práce.`,
  });

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");
}

export async function createPhase(formData: FormData) {
  await requireUser();

  const projectId = formData.get("projectId");
  const name = formData.get("name");
  if (typeof projectId !== "string" || typeof name !== "string") return;
  if (name.trim() === "") return;

  const last = await prisma.projectPhase.findFirst({
    where: { projectId },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const created = await prisma.projectPhase.create({
    data: {
      projectId,
      name: name.trim(),
      position: (last?.position ?? -1) + 1,
    },
    select: { project: { select: { clientId: true } } },
  });

  revalidatePath(`/clients/${created.project.clientId}`);
  revalidatePath("/projects");
}

export async function renamePhase(formData: FormData) {
  await requireUser();

  const phaseId = formData.get("phaseId");
  const name = formData.get("name");
  if (typeof phaseId !== "string" || typeof name !== "string") return;
  if (name.trim() === "") return;

  const phase = await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { name: name.trim() },
    select: { project: { select: { clientId: true } } },
  });

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");
}

/**
 * Smaže fázi i s jejími úkoly. Poslední fáze zůstat musí, jinak by zakázka
 * neměla kam zadávat úkoly. Schválení klientem zůstane zachované, protože si
 * nese název fáze v sobě.
 */
export async function deletePhase(formData: FormData) {
  await requireUser();

  const phaseId = formData.get("phaseId");
  if (typeof phaseId !== "string") return;

  const phase = await prisma.projectPhase.findUnique({
    where: { id: phaseId },
    select: { projectId: true, project: { select: { clientId: true } } },
  });
  if (!phase) return;

  const count = await prisma.projectPhase.count({
    where: { projectId: phase.projectId },
  });
  if (count <= 1) return;

  await prisma.projectPhase.delete({ where: { id: phaseId } });

  // Pozice srovnáme, aby v nich nezůstaly díry a šlo přidávat na konec.
  const remaining = await prisma.projectPhase.findMany({
    where: { projectId: phase.projectId },
    orderBy: { position: "asc" },
    select: { id: true },
  });
  for (const [index, item] of remaining.entries()) {
    await prisma.projectPhase.update({
      where: { id: item.id },
      data: { position: index },
    });
  }

  revalidatePath(`/clients/${phase.project.clientId}`);
  revalidatePath("/projects");
}

export async function updateProjectPortal(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  await requireUser();

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || projectId === "") {
    return { error: "Chybí identifikátor zakázky." };
  }

  const parsed = PortalSchema.safeParse({
    portalNote: formData.get("portalNote"),
    previewUrl: formData.get("previewUrl"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const project = await prisma.project.update({
    where: { id: projectId },
    data: parsed.data,
    select: { clientId: true },
  });

  revalidatePath(`/clients/${project.clientId}`);
  return undefined;
}

export async function updatePhaseDueDate(formData: FormData) {
  await requireUser();

  const phaseId = formData.get("phaseId");
  const dueDate = formData.get("dueDate");
  if (typeof phaseId !== "string") return;

  let parsed: Date | null = null;
  if (typeof dueDate === "string" && dueDate.trim() !== "") {
    parsed = new Date(dueDate);
    if (Number.isNaN(parsed.getTime())) return;
  }

  const phase = await prisma.projectPhase.update({
    where: { id: phaseId },
    data: { dueDate: parsed },
    select: { project: { select: { clientId: true } } },
  });

  revalidatePath(`/clients/${phase.project.clientId}`);
}

export async function setProjectStatus(formData: FormData) {
  await requireUser();

  const projectId = formData.get("projectId");
  const status = formData.get("status");
  if (typeof projectId !== "string") return;

  const validStatus = Object.values(ProjectStatus).find((s) => s === status);
  if (!validStatus) return;

  const project = await prisma.project.update({
    where: { id: projectId },
    data: { status: validStatus },
    select: { clientId: true },
  });

  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/projects");
}

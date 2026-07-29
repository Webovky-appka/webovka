"use server";

import { ProjectStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { logSystemEvent } from "@/lib/events";
import { PHASE_LABELS, PHASE_ORDER } from "@/lib/phases";
import { prisma } from "@/lib/prisma";

export type ProjectFormState = { error?: string } | undefined;

const PortalSchema = z.object({
  portalNote: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  previewUrl: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .refine(
      (value) => value === null || /^https?:\/\//.test(value),
      "Odkaz na náhled musí začínat http:// nebo https://",
    ),
  dueDate: z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : new Date(value)))
    .nullable()
    .refine(
      (value) => value === null || !Number.isNaN(value.getTime()),
      "Neplatné datum.",
    ),
});

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

  const templates = await prisma.taskTemplate.findMany({
    orderBy: [{ phase: "asc" }, { position: "asc" }],
  });

  await prisma.project.create({
    data: {
      clientId,
      name: name.trim(),
      tasks: {
        create: templates.map((template) => ({
          title: template.title,
          phase: template.phase,
          position: template.position,
        })),
      },
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
  return undefined;
}

export async function changePhase(formData: FormData) {
  const user = await requireUser();

  const projectId = formData.get("projectId");
  const target = formData.get("phase");

  if (typeof projectId !== "string") return;
  const toPhase = PHASE_ORDER.find((phase) => phase === target);
  if (!toPhase) return;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true, phase: true },
  });
  if (!project || project.phase === toPhase) return;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { phase: toPhase },
    }),
    prisma.phaseChange.create({
      data: {
        projectId,
        fromPhase: project.phase,
        toPhase,
        userId: user.id,
      },
    }),
  ]);

  await logSystemEvent({
    clientId: project.clientId,
    projectId,
    body: `${user.name} změnil fázi z „${PHASE_LABELS[project.phase]}“ na „${PHASE_LABELS[toPhase]}“.`,
  });

  revalidatePath(`/clients/${project.clientId}`);
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
    dueDate: formData.get("dueDate"),
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

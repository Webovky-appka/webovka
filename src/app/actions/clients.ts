"use server";

import { ClientStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { createProjectWithPhases } from "./projects";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const ClientSchema = z.object({
  companyName: z.string().trim().min(1, "Zadejte název firmy."),
  contactPerson: optionalText,
  email: optionalText,
  phone: optionalText,
  website: optionalText,
  ico: optionalText,
  address: optionalText,
  internalNote: optionalText,
});

const NewClientSchema = ClientSchema.extend({
  projectName: z.string().trim().min(1, "Zadejte název zakázky."),
});

export type ClientFormState = { error?: string } | undefined;

function readForm(formData: FormData) {
  return {
    companyName: formData.get("companyName"),
    contactPerson: formData.get("contactPerson"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    website: formData.get("website"),
    ico: formData.get("ico"),
    address: formData.get("address"),
    internalNote: formData.get("internalNote"),
  };
}

export async function createClient(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireUser();

  const parsed = NewClientSchema.safeParse({
    ...readForm(formData),
    projectName: formData.get("projectName"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const { projectName, ...clientData } = parsed.data;

  const client = await prisma.client.create({
    data: { ...clientData, status: ClientStatus.ACTIVE },
  });

  // Fáze i úkoly se předvyplní z předlohy, ať zakázka nezačíná prázdná.
  await createProjectWithPhases(client.id, projectName);

  revalidatePath("/projects");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClient(
  _prevState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  await requireUser();

  const clientId = formData.get("clientId");
  if (typeof clientId !== "string" || clientId === "") {
    return { error: "Chybí identifikátor klienta." };
  }

  const parsed = ClientSchema.safeParse(readForm(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  // Stav se mění zvlášť v Nastavení, ať se uložením kontaktů nedá omylem
  // přepsat archivace.
  await prisma.client.update({
    where: { id: clientId },
    data: parsed.data,
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
  revalidatePath("/clients");
  return undefined;
}

/** Mění stav klienta. Ukládá se hned při přepnutí, bez tlačítka. */
export async function setClientStatus(formData: FormData) {
  await requireUser();

  const clientId = formData.get("clientId");
  const status = formData.get("status");
  if (typeof clientId !== "string" || clientId === "") return;

  const validStatus = Object.values(ClientStatus).find((s) => s === status);
  if (!validStatus) return;

  const current = await prisma.client.findUnique({
    where: { id: clientId },
    select: { archivedAt: true },
  });
  if (!current) return;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      status: validStatus,
      // Datum archivace se drží od prvního zaarchivování, opakované nastavení
      // stejného stavu ho nepřepíše.
      archivedAt:
        validStatus === ClientStatus.ARCHIVED
          ? (current.archivedAt ?? new Date())
          : null,
    },
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/projects");
  revalidatePath("/clients");
}

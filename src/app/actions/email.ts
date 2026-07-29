"use server";

import { AuthorType, MessageKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import * as z from "zod";

import { generateText, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import {
  buildContextText,
  isTone,
  splitDraft,
  systemPrompt,
  templateDraft,
  userPrompt,
  type EmailContext,
} from "@/lib/email-draft";
import { sendGmail } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export type EmailState =
  | {
      error?: string;
      success?: string;
      /** Podklady, které se posílaly modelu. Ukazujeme je, ať je vidět všechno. */
      context?: string;
      subject?: string;
      body?: string;
      source?: "ai" | "template";
      /** Jestli podklady opravdu odešly do OpenAI. Tvrzení v UI musí být pravdivé. */
      contextSent?: boolean;
    }
  | undefined;

const AddressSchema = z.object({
  to: z.string().trim().pipe(z.email("Zadejte platnou e-mailovou adresu.")),
  subject: z.string().trim().min(1, "Zadejte předmět."),
  // Textarea posílá konce řádků jako CRLF. Do databáze chceme obyčejné \n,
  // do e-mailu se CRLF vrátí až při skládání zprávy.
  body: z
    .string()
    .trim()
    .min(1, "E-mail nemá žádný text.")
    .transform((value) => value.replace(/\r\n/g, "\n")),
});

function signature(): string {
  return process.env.MAIL_SIGNATURE ?? "Váš dodavatel webu";
}

/** Posbírá vše o zakázce. Interní poznámka se přidá jen na výslovné přání. */
async function gatherContext(
  projectId: string,
  includeInternal: boolean,
): Promise<{ context: EmailContext; clientId: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      status: true,
      portalNote: true,
      previewUrl: true,
      clientId: true,
      client: {
        select: {
          companyName: true,
          contactPerson: true,
          email: true,
          website: true,
          internalNote: true,
        },
      },
      phases: {
        orderBy: { position: "asc" },
        select: {
          name: true,
          completedAt: true,
          dueDate: true,
          tasks: {
            where: { done: false },
            orderBy: { position: "asc" },
            select: { title: true },
          },
        },
      },
      approvals: {
        orderBy: { createdAt: "desc" },
        select: { phaseName: true, createdAt: true },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          createdAt: true,
          kind: true,
          body: true,
          authorType: true,
          author: { select: { name: true } },
        },
      },
    },
  });

  if (!project) return null;

  const firstUnfinished = project.phases.find(
    (phase) => phase.completedAt === null,
  );

  const STATUS_LABELS: Record<string, string> = {
    ACTIVE: "aktivní",
    DONE: "dokončená",
    ARCHIVED: "archivovaná",
  };

  return {
    clientId: project.clientId,
    context: {
      companyName: project.client.companyName,
      contactPerson: project.client.contactPerson,
      clientEmail: project.client.email,
      website: project.client.website,
      projectName: project.name,
      projectStatus: STATUS_LABELS[project.status] ?? project.status,
      currentPhaseName: firstUnfinished?.name ?? null,
      phases: project.phases.map((phase) => ({
        name: phase.name,
        completed: phase.completedAt !== null,
        dueDate: phase.dueDate,
        openTasks: phase.tasks.map((task) => task.title),
      })),
      portalNote: project.portalNote,
      previewUrl: project.previewUrl,
      approvals: project.approvals,
      messages: project.messages.map((message) => ({
        createdAt: message.createdAt,
        kind: message.kind,
        author:
          message.authorType === AuthorType.CLIENT
            ? "klient"
            : (message.author?.name ?? "systém"),
        body: message.body,
      })),
      internalNote: includeInternal ? project.client.internalNote : null,
    },
  };
}

function readProjectId(formData: FormData): string | null {
  const value = formData.get("projectId");
  return typeof value === "string" && value !== "" ? value : null;
}

/**
 * Načte podklady, a když se nezastavíme u nich, složí i návrh e-mailu.
 * S klíčem k modelu ho napíše model, bez klíče se použije šablona — v tom
 * případě se zadání nezpracuje a UI to musí říct.
 */
export async function composeEmail(
  prevState: EmailState,
  formData: FormData,
): Promise<EmailState> {
  await requireUser();

  // Hotový návrh se nesmí ztratit, když se pak jen načtou podklady nebo když
  // chybí zadání — jinak by uživatel přišel o rozepsaný text.
  const keepDraft = {
    subject: prevState?.subject,
    body: prevState?.body,
    source: prevState?.source,
  };

  const projectId = readProjectId(formData);
  if (!projectId) return { ...keepDraft, error: "Chybí identifikátor zakázky." };

  const instruction = String(formData.get("instruction") ?? "").trim();
  const toneValue = formData.get("tone");
  const tone = isTone(toneValue) ? toneValue : "formal";

  const loaded = await gatherContext(
    projectId,
    formData.get("includeInternal") === "on",
  );
  if (!loaded) return { ...keepDraft, error: "Zakázka nenalezena." };

  const context = buildContextText(loaded.context);

  // Načtení podkladů je samostatný krok, aby šlo zkontrolovat, co se posílá
  // do modelu, ještě než se tam něco pošle.
  if (formData.get("mode") === "context") {
    return { ...keepDraft, context, contextSent: false };
  }

  const fallback = templateDraft(loaded.context, signature());

  if (!isAiConfigured()) {
    return {
      ...fallback,
      context,
      source: "template",
      contextSent: false,
    };
  }

  if (instruction === "") {
    return {
      ...keepDraft,
      error: "Napište, co má e-mail klientovi říct.",
      context,
      contextSent: false,
    };
  }

  const result = await generateText({
    system: systemPrompt(tone),
    prompt: userPrompt(loaded.context, instruction, signature()),
  });

  if ("error" in result) {
    // Návrh ze šablony je lepší než prázdná obrazovka, ale chybu je vidět.
    // Podklady už do OpenAI odešly, i když model neodpověděl.
    return {
      ...fallback,
      context,
      source: "template",
      contextSent: true,
      error: `${result.error} Zobrazený návrh je ze šablony.`,
    };
  }

  return {
    ...splitDraft(result.text, fallback.subject),
    context,
    source: "ai",
    contextSent: true,
  };
}

async function recordEmail({
  clientId,
  projectId,
  userId,
  to,
  subject,
  body,
  sent,
}: {
  clientId: string;
  projectId: string;
  userId: string;
  to: string;
  subject: string;
  body: string;
  sent: boolean;
}): Promise<void> {
  await prisma.message.create({
    data: {
      clientId,
      projectId,
      authorType: AuthorType.USER,
      authorId: userId,
      kind: MessageKind.EMAIL,
      body: [
        `${sent ? "Odesláno" : "Zapsáno"} na ${to} — předmět: ${subject}`,
        "",
        body,
      ].join("\n"),
    },
  });
}

/**
 * Odešle e-mail z Gmailu přihlášeného uživatele, nebo ho jen zapíše do
 * komunikace. Odesílá se výhradně při mode=send — chybějící volba nikdy nesmí
 * skončit odesláním.
 */
export async function deliverEmail(
  _prevState: EmailState,
  formData: FormData,
): Promise<EmailState> {
  const user = await requireUser();

  const projectId = readProjectId(formData);
  if (!projectId) return { error: "Chybí identifikátor zakázky." };

  const parsed = AddressSchema.safeParse({
    to: formData.get("to"),
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true },
  });
  if (!project) return { error: "Zakázka nenalezena." };

  const send = formData.get("mode") === "send";
  let fromAddress: string | null = null;

  if (send) {
    const account = await prisma.googleAccount.findUnique({
      where: { userId: user.id },
      select: { email: true },
    });
    if (!account) {
      return { error: "Účet není napojený na Gmail. Napojte ho v Nastavení." };
    }

    const result = await sendGmail({
      userId: user.id,
      from: account.email,
      fromName: user.name,
      to: parsed.data.to,
      subject: parsed.data.subject,
      body: parsed.data.body,
    });
    if ("error" in result) return { error: result.error };

    fromAddress = account.email;
  }

  await recordEmail({
    clientId: project.clientId,
    projectId,
    userId: user.id,
    to: parsed.data.to,
    subject: parsed.data.subject,
    body: parsed.data.body,
    sent: send,
  });

  revalidatePath(`/clients/${project.clientId}`);
  revalidatePath("/projects");

  return {
    success: send
      ? `Odesláno na ${parsed.data.to} z adresy ${fromAddress}. Zápis je v komunikaci.`
      : "Zapsáno do komunikace. Nic se neodeslalo.",
  };
}

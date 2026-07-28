"use server";

import argon2 from "argon2";
import { AuthorType, MessageKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import * as z from "zod";

import { requireUser } from "@/lib/auth";
import { logSystemEvent } from "@/lib/events";
import { PHASE_LABELS } from "@/lib/phases";
import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_MINUTES,
  defaultExpiry,
  generatePin,
  generatePortalToken,
  hashPortalToken,
  isLinkUsable,
  isLocked,
  portalUrl,
} from "@/lib/portal";
import { prisma } from "@/lib/prisma";
import {
  PORTAL_TTL_SECONDS,
  cookieOptions,
  createPortalToken,
  portalCookieName,
  verifyToken,
} from "@/lib/session";

export type PortalLinkState =
  | { error?: string; url?: string; pin?: string }
  | undefined;

/**
 * Vytvoří nový portálový odkaz a PIN. Starý odkaz se deaktivuje, aby platil
 * vždy jen jeden. Token a PIN se v čitelné podobě vrací jedinkrát — potom
 * už je v databázi jen hash.
 */
export async function createPortalLink(
  _prevState: PortalLinkState,
  formData: FormData,
): Promise<PortalLinkState> {
  const user = await requireUser();

  const projectId = formData.get("projectId");
  if (typeof projectId !== "string" || projectId === "") {
    return { error: "Chybí identifikátor zakázky." };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, clientId: true },
  });
  if (!project) return { error: "Zakázka neexistuje." };

  const token = generatePortalToken();
  const pin = generatePin();

  await prisma.$transaction([
    prisma.portalLink.updateMany({
      where: { projectId, active: true },
      data: { active: false },
    }),
    prisma.portalLink.create({
      data: {
        projectId,
        tokenHash: hashPortalToken(token),
        pinHash: await argon2.hash(pin),
        expiresAt: defaultExpiry(),
      },
    }),
  ]);

  await logSystemEvent({
    clientId: project.clientId,
    projectId,
    body: `${user.name} vygeneroval nový odkaz do klientského portálu. Předchozí odkaz přestal platit.`,
  });

  revalidatePath(`/clients/${project.clientId}`);
  return { url: portalUrl(token), pin };
}

export async function revokePortalLink(formData: FormData) {
  const user = await requireUser();

  const portalLinkId = formData.get("portalLinkId");
  if (typeof portalLinkId !== "string") return;

  const link = await prisma.portalLink.findUnique({
    where: { id: portalLinkId },
    select: { id: true, project: { select: { id: true, clientId: true } } },
  });
  if (!link) return;

  await prisma.portalLink.update({
    where: { id: portalLinkId },
    data: { active: false },
  });

  await logSystemEvent({
    clientId: link.project.clientId,
    projectId: link.project.id,
    body: `${user.name} zneplatnil odkaz do klientského portálu.`,
  });

  revalidatePath(`/clients/${link.project.clientId}`);
}

export type PinState = { error?: string } | undefined;

/** Ověření PINu klientem. Chráněno počítadlem pokusů a dočasným zamčením. */
export async function verifyPin(
  _prevState: PinState,
  formData: FormData,
): Promise<PinState> {
  const parsed = z
    .object({
      token: z.string().trim().min(1),
      pin: z.string().trim().regex(/^\d{6}$/, "PIN má šest číslic."),
    })
    .safeParse({ token: formData.get("token"), pin: formData.get("pin") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný PIN." };
  }

  const link = await prisma.portalLink.findUnique({
    where: { tokenHash: hashPortalToken(parsed.data.token) },
  });

  if (!link || !isLinkUsable(link)) {
    return { error: "Odkaz už neplatí. Vyžádejte si u nás nový." };
  }

  if (isLocked(link)) {
    return {
      error: `Příliš mnoho pokusů. Zkuste to znovu za ${PIN_LOCK_MINUTES} minut.`,
    };
  }

  const pinMatches = await argon2.verify(link.pinHash, parsed.data.pin);

  if (!pinMatches) {
    const attempts = link.failedAttempts + 1;
    const shouldLock = attempts >= MAX_PIN_ATTEMPTS;

    await prisma.portalLink.update({
      where: { id: link.id },
      data: {
        failedAttempts: shouldLock ? 0 : attempts,
        lockedUntil: shouldLock
          ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000)
          : null,
      },
    });

    if (shouldLock) {
      const project = await prisma.project.findUnique({
        where: { id: link.projectId },
        select: { clientId: true },
      });
      if (project) {
        await logSystemEvent({
          clientId: project.clientId,
          projectId: link.projectId,
          body: `Portál byl zamčen na ${PIN_LOCK_MINUTES} minut po ${MAX_PIN_ATTEMPTS} neúspěšných pokusech o PIN.`,
        });
      }
      return {
        error: `Příliš mnoho pokusů. Zkuste to znovu za ${PIN_LOCK_MINUTES} minut.`,
      };
    }

    const remaining = MAX_PIN_ATTEMPTS - attempts;
    return {
      error: `Nesprávný PIN. Zbývají ${remaining} ${remaining === 1 ? "pokus" : remaining < 5 ? "pokusy" : "pokusů"}.`,
    };
  }

  await prisma.portalLink.update({
    where: { id: link.id },
    data: {
      failedAttempts: 0,
      lockedUntil: null,
      lastVisitedAt: new Date(),
    },
  });

  const store = await cookies();
  store.set(portalCookieName(link.id), createPortalToken(link.id), {
    ...cookieOptions,
    maxAge: PORTAL_TTL_SECONDS,
  });

  revalidatePath(`/portal/${parsed.data.token}`);
  return undefined;
}

/** Ověří, že klient prošel PIN gate pro daný odkaz. */
async function requirePortalSession(portalLinkId: string): Promise<boolean> {
  const store = await cookies();
  const value = store.get(portalCookieName(portalLinkId))?.value;
  return verifyToken(value) === portalLinkId;
}

async function loadPortalLink(token: string) {
  const link = await prisma.portalLink.findUnique({
    where: { tokenHash: hashPortalToken(token) },
    include: {
      project: {
        select: { id: true, clientId: true, name: true, phase: true },
      },
    },
  });
  if (!link || !isLinkUsable(link)) return null;
  return link;
}

async function clientIpAddress(): Promise<string | null> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? null;
}

export type PortalActionState = { error?: string; success?: string } | undefined;

export async function approvePhase(
  _prevState: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const token = formData.get("token");
  if (typeof token !== "string") return { error: "Neplatný požadavek." };

  const link = await loadPortalLink(token);
  if (!link) return { error: "Odkaz už neplatí." };
  if (!(await requirePortalSession(link.id))) {
    return { error: "Zadejte prosím znovu PIN." };
  }

  const alreadyApproved = await prisma.approval.findFirst({
    where: { projectId: link.projectId, phase: link.project.phase },
  });
  if (alreadyApproved) {
    return { error: "Tuto fázi jste už schválili." };
  }

  await prisma.approval.create({
    data: {
      projectId: link.projectId,
      phase: link.project.phase,
      ipAddress: await clientIpAddress(),
      portalLinkId: link.id,
    },
  });

  await logSystemEvent({
    clientId: link.project.clientId,
    projectId: link.projectId,
    body: `Klient schválil fázi „${PHASE_LABELS[link.project.phase]}“ v portálu.`,
  });

  revalidatePath(`/portal/${token}`);
  revalidatePath(`/clients/${link.project.clientId}`);
  return { success: "Schválení jsme zaznamenali. Děkujeme." };
}

export async function submitPortalFeedback(
  _prevState: PortalActionState,
  formData: FormData,
): Promise<PortalActionState> {
  const parsed = z
    .object({
      token: z.string().trim().min(1),
      body: z.string().trim().min(1, "Napište prosím text připomínky."),
    })
    .safeParse({ token: formData.get("token"), body: formData.get("body") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Neplatný vstup." };
  }

  const link = await loadPortalLink(parsed.data.token);
  if (!link) return { error: "Odkaz už neplatí." };
  if (!(await requirePortalSession(link.id))) {
    return { error: "Zadejte prosím znovu PIN." };
  }

  await prisma.message.create({
    data: {
      clientId: link.project.clientId,
      projectId: link.projectId,
      authorType: AuthorType.CLIENT,
      kind: MessageKind.PORTAL_FEEDBACK,
      body: parsed.data.body,
    },
  });

  revalidatePath(`/portal/${parsed.data.token}`);
  revalidatePath(`/clients/${link.project.clientId}`);
  return { success: "Připomínku jsme dostali. Ozveme se." };
}

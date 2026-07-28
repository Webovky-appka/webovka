import "server-only";

import type { Phase } from "@prisma/client";

import { appUrl, notificationRecipients, sendMail } from "@/lib/mail";
import { PHASE_LABELS } from "@/lib/phases";

export async function notifyPhaseApproved({
  clientId,
  companyName,
  projectName,
  phase,
}: {
  clientId: string;
  companyName: string;
  projectName: string;
  phase: Phase;
}): Promise<void> {
  await sendMail({
    to: await notificationRecipients(),
    subject: `${companyName} schválil fázi ${PHASE_LABELS[phase]}`,
    text: [
      `Klient ${companyName} schválil fázi „${PHASE_LABELS[phase]}“ u zakázky ${projectName}.`,
      "",
      `Detail klienta: ${appUrl(`/clients/${clientId}`)}`,
    ].join("\n"),
  });
}

export async function notifyPortalFeedback({
  clientId,
  companyName,
  projectName,
  body,
}: {
  clientId: string;
  companyName: string;
  projectName: string;
  body: string;
}): Promise<void> {
  await sendMail({
    to: await notificationRecipients(),
    subject: `${companyName} poslal připomínku`,
    text: [
      `Klient ${companyName} poslal připomínku k zakázce ${projectName}:`,
      "",
      body,
      "",
      `Detail klienta: ${appUrl(`/clients/${clientId}`)}`,
    ].join("\n"),
  });
}

/**
 * Informuje klienta, že se zakázka posunula. Odkaz do portálu do e-mailu vložit
 * nelze — v databázi máme jen hash tokenu, takže původní odkaz nedokážeme
 * zrekonstruovat. Klient použije ten, který od nás dostal při zřízení portálu.
 */
export async function notifyClientPhaseChanged({
  clientEmail,
  projectName,
  phase,
  portalNote,
}: {
  clientEmail: string | null;
  projectName: string;
  phase: Phase;
  portalNote: string | null;
}): Promise<void> {
  if (!clientEmail) return;

  const signature = process.env.MAIL_SIGNATURE ?? "Váš dodavatel webu";

  await sendMail({
    to: clientEmail,
    subject: `${projectName}: fáze ${PHASE_LABELS[phase]}`,
    text: [
      "Dobrý den,",
      "",
      `zakázka ${projectName} se posunula do fáze „${PHASE_LABELS[phase]}“.`,
      ...(portalNote ? ["", portalNote] : []),
      "",
      "Podrobnosti najdete ve svém projektovém odkazu, který jste od nás dostali.",
      "",
      "S pozdravem",
      signature,
    ].join("\n"),
  });
}

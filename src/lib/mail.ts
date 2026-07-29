import "server-only";

import { Resend } from "resend";

/**
 * Odesílání e-mailů. Bez RESEND_API_KEY se zpráva jen zaloguje do konzole —
 * lokální vývoj tak nepotřebuje účet u Resendu a notifikace jde odzkoušet.
 *
 * Selhání odeslání nikdy nesmí shodit akci, která e-mail vyvolala: schválení
 * fáze klientem je důležitější než notifikace o něm.
 */
type SendArgs = {
  to: string | string[];
  subject: string;
  text: string;
};

function isConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail({ to, subject, text }: SendArgs): Promise<void> {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (recipients.length === 0) return;

  if (!isConfigured()) {
    console.info(
      `[mail] Neodesláno, chybí RESEND_API_KEY nebo MAIL_FROM.\n  Komu: ${recipients.join(", ")}\n  Předmět: ${subject}\n  ${text.replace(/\n/g, "\n  ")}`,
    );
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.MAIL_FROM!,
      to: recipients,
      subject,
      text,
    });

    if (result.error) {
      console.error("[mail] Odeslání selhalo:", result.error.message);
    }
  } catch (error) {
    console.error("[mail] Odeslání selhalo:", error);
  }
}

/** Adresy, na které chodí notifikace o aktivitě klientů. */
export async function notificationRecipients(): Promise<string[]> {
  const configured = process.env.NOTIFY_EMAILS;
  if (configured) {
    return configured
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  // Bez explicitního nastavení posíláme všem interním účtům.
  const { prisma } = await import("@/lib/prisma");
  const users = await prisma.user.findMany({ select: { email: true } });
  return users.map((user) => user.email);
}

export function appUrl(path = ""): string {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

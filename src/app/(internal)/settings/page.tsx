import { UserRole } from "@prisma/client";

import { CalibrationPanel } from "@/components/settings/calibration-panel";
import { EmailSamplesPanel } from "@/components/settings/email-samples-panel";
import { GmailPanel } from "@/components/settings/gmail-panel";
import { GoogleLinksForm } from "@/components/settings/google-links-form";
import { LegalPanel } from "@/components/settings/legal-panel";
import { StudioProfileForm } from "@/components/settings/studio-profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { TaskTemplatePanel } from "@/components/settings/task-template-panel";
import { aiModel, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { googleAccountFor, isGoogleConfigured } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Nastavení — Mitsov Web",
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  DEVELOPER: "Vývojář",
};

export default async function SettingsPage(props: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const currentUser = await requireUser();
  const { gmail } = await props.searchParams;

  const [users, templates, account, studio, rated, samples] = await Promise.all(
    [
      prisma.user.findMany({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, role: true },
      }),
      prisma.phaseTemplate.findMany({
        orderBy: { position: "asc" },
        include: { tasks: { orderBy: { position: "asc" } } },
      }),
      googleAccountFor(currentUser.id),
      prisma.studioProfile.findUnique({ where: { id: "studio" } }),
      // Sbírka vzorů pro kalibraci auditu — od nejlepšího webu k nejhoršímu.
      prisma.salesLead.findMany({
        where: { humanWebScore: { not: null } },
        orderBy: [{ humanWebScore: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          humanWebScore: true,
          humanWebNote: true,
          websiteScore: true,
          screenshotDesktopKey: true,
          prospect: { select: { name: true, domain: true } },
          campaign: { select: { name: true } },
        },
      }),
      prisma.salesEmailSample.findMany({
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          label: true,
          subject: true,
          body: true,
          note: true,
          active: true,
        },
      }),
    ],
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        Nastavení
      </h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Změna hesla
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Přihlášen jako {currentUser.name} ({currentUser.email}).
            </p>
          </div>
          <PasswordForm />

          <hr className="border-slate-100" />

          <GoogleLinksForm index={currentUser.googleAccountIndex} />
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Účty</h2>
            <p className="mt-1 text-xs text-slate-500">
              Registrace není otevřená. Nové účty se zakládají přímo v databázi
              seed skriptem.
            </p>
          </div>

          <ul className="divide-y divide-slate-100 text-sm">
            {users.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-slate-900">{user.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {user.email}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {ROLE_LABELS[user.role]}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Naše údaje do smluv
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Doplní se do smlouvy jako zhotovitel. Co tu není, bude ve smlouvě
              označené k doplnění.
            </p>
          </div>
          <StudioProfileForm profile={studio} fallbackName={currentUser.name} />
        </section>

        <LegalPanel />

        <GmailPanel
          account={account}
          configured={isGoogleConfigured()}
          aiReady={isAiConfigured()}
          aiModel={aiModel()}
          result={typeof gmail === "string" ? gmail : undefined}
        />
      </div>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Předloha nových zakázek
        </h2>
        <TaskTemplatePanel templates={templates} />
      </section>

      <EmailSamplesPanel samples={samples} />

      <CalibrationPanel
        items={rated.map((lead) => ({
          leadId: lead.id,
          companyName: lead.prospect.name,
          domain: lead.prospect.domain,
          humanWebScore: lead.humanWebScore ?? 0,
          humanWebNote: lead.humanWebNote,
          modelScore: lead.websiteScore,
          hasScreenshot: lead.screenshotDesktopKey !== null,
          campaignName: lead.campaign.name,
        }))}
      />
    </div>
  );
}

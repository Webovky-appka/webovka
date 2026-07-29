import { UserRole } from "@prisma/client";

import { GmailPanel } from "@/components/settings/gmail-panel";
import { PasswordForm } from "@/components/settings/password-form";
import { TaskTemplatePanel } from "@/components/settings/task-template-panel";
import { aiModel, isAiConfigured } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { googleAccountFor, isGoogleConfigured } from "@/lib/google";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Nastavení — Stavba webu",
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

  const [users, templates, account] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.phaseTemplate.findMany({
      orderBy: { position: "asc" },
      include: { tasks: { orderBy: { position: "asc" } } },
    }),
    googleAccountFor(currentUser.id),
  ]);

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
    </div>
  );
}

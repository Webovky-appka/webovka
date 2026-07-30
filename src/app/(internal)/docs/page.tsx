import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  googleAccountFor,
  hasDocsAccess,
  isGoogleConfigured,
} from "@/lib/google";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Dokumenty — Mitsov Web",
};

/**
 * Přehled dokumentů přes všechny zakázky. Vypisuje se z naší databáze, ne z
 * Drive — s oprávněním drive.file aplikace obsah Drive prohlížet nemůže, vidí
 * jen soubory, které sama založila.
 */
export default async function DocsPage() {
  const user = await requireUser();

  const [account, docs] = await Promise.all([
    googleAccountFor(user.id),
    prisma.projectDoc.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        webViewLink: true,
        createdAt: true,
        createdBy: { select: { name: true } },
        project: {
          select: { id: true, name: true, client: { select: { id: true, companyName: true } } },
        },
      },
    }),
  ]);

  const docsAllowed = hasDocsAccess(account?.scope);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Dokumenty
        </h1>
        <p className="text-sm text-slate-500">
          Dokumenty založené z aplikace do Google Docs. Nové se zakládají u
          konkrétní zakázky.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Účet Google</h2>

        {!isGoogleConfigured() ? (
          <p className="text-sm text-slate-600">
            Chybí GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET. Postup je v
            DEPLOYMENT.md.
          </p>
        ) : account ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-700">
              Napojeno na <strong>{account.email}</strong> od{" "}
              {formatDate(account.createdAt)}.
            </p>
            {docsAllowed ? (
              <p className="text-xs text-slate-500">
                Aplikace může zakládat dokumenty a psát jen do nich. Na ostatní
                obsah vašeho Drive nevidí.
              </p>
            ) : (
              <div className="space-y-2 rounded-lg bg-amber-50 px-3 py-2.5">
                <p className="text-sm text-amber-900">
                  Napojení je starší a nemá právo zakládat dokumenty.
                </p>
                <a
                  href="/api/google/connect"
                  className="inline-block rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  Napojit účet znovu
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Účet Google zatím není napojený. Bez napojení se dokumenty
              zakládat nedají.
            </p>
            <a
              href="/api/google/connect"
              className="inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Napojit účet Google
            </a>
          </div>
        )}
      </section>

      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <p className="font-medium text-slate-900">Zatím žádný dokument</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Otevřete zakázku, přepněte na záložku Dokumenty a založte první z
            předlohy.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {docs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <a
                  href={doc.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm text-sky-700 underline hover:text-sky-900"
                >
                  {doc.title}
                </a>
                <p className="truncate text-xs text-slate-500">
                  {doc.createdBy?.name ?? "Neznámý"} ·{" "}
                  {formatDateTime(doc.createdAt)}
                </p>
              </div>

              <Link
                href={`/clients/${doc.project.client.id}?project=${doc.project.id}&tab=docs`}
                className="shrink-0 text-xs text-slate-500 transition hover:text-slate-900"
              >
                {doc.project.client.companyName} · {doc.project.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

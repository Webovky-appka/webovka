import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/projects"
              className="font-semibold tracking-tight text-slate-900"
            >
              Stavba webu
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/projects"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Zakázky
              </Link>
              <Link
                href="/clients"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Klienti
              </Link>
              <Link
                href="/settings"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Nastavení
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {user.name}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
    </>
  );
}

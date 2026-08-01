import Link from "next/link";

import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/auth";

/**
 * Rychlé odkazy do Googlu, dokud nefunguje napojení účtu. Otevírají se v nové
 * kartě, ať se neztratí rozdělaná práce v aplikaci.
 *
 * „u/6“ v adrese je pořadí účtu přihlášeného v prohlížeči, ne jméno účtu, a
 * každý ho má jiné. Proto si ho každý nastavuje sám v Nastavení; nastavení
 * celého nasazení slouží jen jako výchozí hodnota.
 */
function googleLinks(userIndex: number | null) {
  const index = userIndex ?? process.env.GOOGLE_ACCOUNT_INDEX ?? "0";

  return [
    {
      label: "Gmail",
      href: `https://mail.google.com/mail/u/${index}/#inbox`,
    },
    {
      label: "Google Docs",
      href: `https://docs.google.com/document/u/${index}/`,
    },
  ];
}

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
              Mitsov Web
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/projects"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Zakázky
              </Link>
              <Link
                href="/docs"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Dokumenty
              </Link>
              <Link
                href="/contracts"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Smlouvy
              </Link>
              <Link
                href="/sales"
                className="text-slate-600 transition hover:text-slate-900"
              >
                AI Sales
              </Link>
              <Link
                href="/settings"
                className="text-slate-600 transition hover:text-slate-900"
              >
                Nastavení
              </Link>

              <span aria-hidden="true" className="text-slate-200">
                |
              </span>

              {googleLinks(user.googleAccountIndex).map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 transition hover:text-slate-900"
                >
                  {link.label}
                  <span aria-hidden="true" className="ml-0.5 text-slate-400">
                    ↗
                  </span>
                </a>
              ))}
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

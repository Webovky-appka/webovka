import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";

import { LoginForm } from "./login-form";

export const metadata = {
  title: "Přihlášení — Stavba webu",
};

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/projects");

  const { next } = await props.searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Stavba webu
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Interní správa klientů a zakázek
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          Přístup mají jen účty založené správcem. Registrace není otevřená.
        </p>
      </div>
    </main>
  );
}

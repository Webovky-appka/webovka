import Link from "next/link";

import { requireUser } from "@/lib/auth";

import { NewClientForm } from "./new-client-form";

export const metadata = {
  title: "Nový klient — Stavba webu",
};

export default async function NewClientPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          href="/clients"
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← Klienti
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Nový klient
        </h1>
      </div>

      <NewClientForm />
    </div>
  );
}

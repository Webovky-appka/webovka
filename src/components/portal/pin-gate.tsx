"use client";

import { useActionState } from "react";

import { verifyPin, type PinState } from "@/app/actions/portal";
import { FormError } from "@/components/field";

export function PinGate({
  token,
  projectName,
}: {
  token: string;
  projectName: string;
}) {
  const [state, formAction, pending] = useActionState<PinState, FormData>(
    verifyPin,
    undefined,
  );

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          {projectName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Zadejte PIN kód, který jste dostali od nás.
        </p>
      </div>

      <form
        action={formAction}
        className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <input type="hidden" name="token" value={token} />

        <div className="space-y-1.5">
          <label
            htmlFor="pin"
            className="block text-sm font-medium text-slate-700"
          >
            PIN kód
          </label>
          <input
            id="pin"
            name="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            placeholder="000000"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-center font-mono text-xl tracking-[0.4em] outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </div>

        <FormError message={state?.error} />

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-slate-900 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Ověřuji…" : "Zobrazit projekt"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        PIN jste nedostali nebo nefunguje? Napište nám a pošleme nový odkaz.
      </p>
    </div>
  );
}

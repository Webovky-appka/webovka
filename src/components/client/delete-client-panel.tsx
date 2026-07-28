"use client";

import { useActionState, useState } from "react";

import {
  deleteClientPermanently,
  type DeleteClientState,
} from "@/app/actions/client-deletion";
import { FormError, inputClasses } from "@/components/field";

export function DeleteClientPanel({
  clientId,
  companyName,
  attachmentCount,
}: {
  clientId: string;
  companyName: string;
  attachmentCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<
    DeleteClientState,
    FormData
  >(deleteClientPermanently, undefined);

  return (
    <section className="space-y-3 rounded-xl border border-red-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-red-900">
          Nevratné smazání klienta
        </h2>
        <p className="mt-1 text-xs text-slate-600">
          Pro žádost o výmaz osobních údajů. Smaže klienta, všechny jeho
          zakázky, úkoly, historii komunikace, schválení a{" "}
          {attachmentCount === 0
            ? "přílohy"
            : `${attachmentCount} příloh včetně souborů v úložišti`}
          . Nejde vrátit. Pokud chcete klienta jen skrýt z přehledů, použijte
          stav Archiv.
        </p>
      </div>

      {open ? (
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="clientId" value={clientId} />

          <div className="space-y-1.5">
            <label
              htmlFor="confirmation"
              className="block text-sm font-medium text-slate-700"
            >
              Pro potvrzení opište název firmy
            </label>
            <input
              id="confirmation"
              name="confirmation"
              required
              autoComplete="off"
              placeholder={companyName}
              className={inputClasses}
            />
          </div>

          <FormError message={state?.error} />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {pending ? "Mažu…" : "Smazat nevratně"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-sm text-slate-600 transition hover:text-slate-900"
            >
              Zrušit
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg border border-red-300 px-3.5 py-2 text-sm text-red-700 transition hover:bg-red-50"
        >
          Smazat klienta a všechna jeho data
        </button>
      )}
    </section>
  );
}

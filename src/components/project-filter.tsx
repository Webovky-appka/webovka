"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

const STATUS_OPTIONS = [
  { value: "active", label: "Aktivní" },
  { value: "done", label: "Dokončené" },
  { value: "archived", label: "Archivované" },
  { value: "all", label: "Vše" },
];

/** Prodleva po posledním písmenu. Kratší by posílala dotaz na každý stisk. */
const TYPING_PAUSE_MS = 250;

/**
 * Filtr zakázek. Hledá se při psaní, stav se přepne hned. Políčko je neřízené
 * a adresa se mění přes replace — kdyby se hodnota vracela ze serveru, psaní by
 * po každé odpovědi poskakovalo a v historii by zůstalo písmeno po písmenu.
 */
export function ProjectFilter({ q, status }: { q: string; status: string }) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);

  function apply(next: { q?: string; status?: string }) {
    const params = new URLSearchParams(window.location.search);

    for (const [key, value] of Object.entries(next)) {
      if (value === undefined) continue;
      if (value === "") params.delete(key);
      else params.set(key, value);
    }

    router.replace(`/projects?${params.toString()}`, { scroll: false });
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Hledat klienta nebo zakázku"
        aria-label="Hledat klienta nebo zakázku"
        onChange={(event) => {
          const value = event.currentTarget.value;
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(
            () => apply({ q: value }),
            TYPING_PAUSE_MS,
          );
        }}
        className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />

      <select
        name="status"
        defaultValue={status}
        aria-label="Stav zakázky"
        onChange={(event) => apply({ status: event.currentTarget.value })}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </form>
  );
}

"use client";

import { AutoSubmitSelect } from "@/components/auto-save";

const STATUS_OPTIONS = [
  { value: "active", label: "Aktivní" },
  { value: "done", label: "Dokončené" },
  { value: "archived", label: "Archivované" },
  { value: "all", label: "Vše" },
];

/**
 * Filtr zakázek. Rozbalovátko se použije hned po přepnutí, hledaný text
 * potvrdíte Enterem — formulář zůstává obyčejný GET, takže funguje i bez
 * JavaScriptu a filtr je vidět v adrese.
 */
export function ProjectFilter({
  q,
  status,
}: {
  q: string;
  status: string;
}) {
  return (
    <form className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Hledat klienta nebo zakázku"
        aria-label="Hledat klienta nebo zakázku"
        className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      />

      <AutoSubmitSelect
        name="status"
        defaultValue={status}
        ariaLabel="Stav zakázky"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-sky-500"
        options={STATUS_OPTIONS}
      />

      <span className="text-xs text-slate-400">Text potvrdíte Enterem</span>
    </form>
  );
}

import type { ReactNode } from "react";

import { missingOperatorFields } from "@/lib/legal";

/**
 * Stavební prvky právních stránek. Typografie je tady, ne v každé stránce —
 * projekt nemá plugin na prose, tak si třídy držíme na jednom místě.
 */
export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function LegalParagraph({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-700">{children}</p>;
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 list-disc space-y-1.5 text-sm leading-relaxed text-slate-700">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

export function LegalTable({
  head,
  rows,
}: {
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-md border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {head.map((cell) => (
              <th
                key={cell}
                className="py-2 pr-4 font-medium text-slate-500 uppercase"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-slate-100 align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="py-2 pr-4 text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Upozornění, že dokument ještě není hotový. Radši křičí na stránce, než aby
 * nedodělaný text tiše odešel klientovi nebo do souhlasné obrazovky Googlu.
 */
export function IncompleteNotice() {
  const missing = missingOperatorFields();
  if (missing.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="text-sm font-medium text-amber-900">
        Dokument není dokončený — nezveřejňujte ho a nezadávejte tuto adresu do
        souhlasné obrazovky Googlu.
      </p>
      <p className="mt-1 text-sm text-amber-900">
        Chybí doplnit v <code>src/lib/legal.ts</code>:
      </p>
      <ul className="mt-1 ml-5 list-disc text-sm text-amber-900">
        {missing.map((field) => (
          <li key={field.label}>
            {field.label} — {field.hint}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Údaj, který se doplňuje později. V textu je pak vidět, že tam něco chybí. */
export function LegalValue({ value }: { value: string }) {
  if (value.trim() !== "") return <>{value}</>;
  return (
    <span className="rounded bg-amber-100 px-1 text-amber-900">
      [doplnit]
    </span>
  );
}

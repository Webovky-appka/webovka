"use client";

import Link from "next/link";
import { useState } from "react";

import {
  DASHBOARD_DISMISS_COOKIE,
  type DashboardItem,
  type DashboardSection,
} from "@/lib/daily-dashboard";

const TONE_STYLES: Record<DashboardSection["tone"], string> = {
  emerald: "text-emerald-700",
  sky: "text-sky-700",
  amber: "text-amber-700",
  slate: "text-slate-700",
};

const META_STYLES: Record<NonNullable<DashboardItem["metaTone"]>, string> = {
  default: "text-slate-400",
  alert: "font-medium text-red-600",
  good: "font-medium text-emerald-700",
};

/**
 * Denní přehled na hlavní stránce: co dnes potřebuje ruce. Zavření křížkem
 * platí do půlnoci a jen pro tento prohlížeč — každý z týmu si zavírá svůj.
 */
export function DailyDashboard({
  dayKey,
  heading,
  sections,
}: {
  dayKey: string;
  heading: string;
  sections: DashboardSection[];
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const dismiss = () => {
    document.cookie = `${DASHBOARD_DISMISS_COOKIE}=${dayKey}; path=/; max-age=86400; samesite=lax`;
    setHidden(true);
  };

  const busy = sections.filter((section) => section.count > 0);

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Dnes — {heading}
          </h2>
          <p className="text-xs text-slate-500">
            {busy.length === 0
              ? "Žádné resty. Křížkem přehled zavřete do zítřka."
              : "Rychlý přehled toho, co dnes potřebuje ruce."}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Zavřít denní přehled do zítřka"
          title="Zavřít do zítřka"
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {busy.length > 0 ? (
        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {busy.map((section) => (
            <div key={section.key} className="min-w-0 space-y-1.5">
              <Link
                href={section.href}
                className={`text-xs font-medium tracking-wide uppercase ${TONE_STYLES[section.tone]} hover:underline`}
              >
                {section.title} ({section.count})
              </Link>
              <ul className="space-y-1">
                {section.items.map((item) => (
                  <li key={item.href + item.label}>
                    <Link
                      href={item.href}
                      className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-sm transition hover:bg-slate-50"
                    >
                      <span className="truncate text-slate-700">
                        {item.label}
                      </span>
                      {item.meta ? (
                        <span
                          className={`shrink-0 text-xs ${META_STYLES[item.metaTone ?? "default"]}`}
                        >
                          {item.meta}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
                {section.count > section.items.length ? (
                  <li>
                    <Link
                      href={section.href}
                      className="block px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                    >
                      … a {section.count - section.items.length} dalších
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

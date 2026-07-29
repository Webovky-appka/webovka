"use client";

import { useState } from "react";

import { CopyButton } from "@/components/copy-button";

/**
 * Náhled webu přímo ve stránce. Řada webů se ale vložit do rámu nenechá —
 * posílají X-Frame-Options: DENY nebo CSP frame-ancestors, a prohlížeč pak
 * zobrazí prázdno. Poznat to zvenčí nejde, proto je vedle vždy odkaz na
 * otevření v nové kartě a tlačítko na zkopírování adresy.
 */
export function SiteEmbed({
  url,
  title,
  defaultOpen = false,
}: {
  url: string;
  title: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-32 flex-1 text-xs text-slate-500">{title}</p>
        <CopyButton value={url} label="Zkopírovat odkaz" />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          Otevřít v nové kartě
        </a>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
        >
          {open ? "Skrýt náhled" : "Zobrazit náhled"}
        </button>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-sm break-all text-sky-700 underline hover:text-sky-900"
      >
        {url}
      </a>

      {open ? (
        <div className="space-y-1">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            <iframe
              src={url}
              title={title}
              loading="lazy"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              className="h-[28rem] w-full bg-white"
            />
          </div>
          <p className="text-xs text-slate-500">
            Když je rámec prázdný, web se vložit nenechá. Otevřete ho v nové
            kartě.
          </p>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { setDesignerEnabled } from "@/app/actions/sales";

/**
 * Vypínač Designera. Platí globálně (ne jen pro tuhle kampaň) a ukládá se
 * hned — vypnutý Designer negeneruje koncepty a příležitosti jdou z researche
 * rovnou na návrh e-mailu.
 */
export function DesignerSwitch({
  enabled,
  campaignId,
}: {
  enabled: boolean;
  campaignId: string;
}) {
  return (
    <form action={setDesignerEnabled} className="space-y-1">
      <input type="hidden" name="campaignId" value={campaignId} />
      <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          className={
            enabled
              ? "rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
              : "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
          }
        >
          {enabled ? "Vypnout Designera" : "Zapnout Designera"}
        </button>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            enabled
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {enabled ? "zapnutý" : "vypnutý"}
        </span>
      </div>
      <p className="text-xs text-slate-500">
        {enabled
          ? "Generuje koncept homepage u příležitostí se skóre 75+ (polovina jich zůstává jako kontrolní skupina). Platí pro všechny kampaně."
          : "Koncepty se negenerují a nic se nelosuje — příležitosti jdou z researche rovnou na e-mail. Platí pro všechny kampaně."}
      </p>
    </form>
  );
}

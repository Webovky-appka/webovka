"use client";

import { useState } from "react";

/**
 * Kopírování do schránky. clipboard API vyžaduje zabezpečené spojení, takže
 * mimo HTTPS a localhost není k dispozici — v takovém případě aspoň text
 * označíme, aby šel zkopírovat klávesnicí.
 */
export function CopyButton({
  value,
  label,
  copiedLabel = "Zkopírováno",
  className = "",
}: {
  value: string;
  label: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Zkopírujte ručně:", value);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        "rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

"use client";

import { useState } from "react";

import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  megabytes,
  planUpload,
} from "@/lib/upload-plan";

/** Delší strana zmenšeného obrázku. Na obrazovku i do dokumentu to stačí. */
const MAX_DIMENSION = 2200;

/** Kvality, kterými se postupně zkouší vejít do limitu. */
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

/**
 * Zmenší obrázek v prohlížeči tak, aby se vešel do limitu. Vrací null, když to
 * nejde — pak se soubor odmítne, místo aby se nahrávání pokoušelo naslepo.
 */
async function shrinkImage(
  file: File,
  maxBytes: number,
): Promise<File | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // WebP drží průhlednost a je výrazně menší než PNG, proto do něj překódováváme.
  for (const quality of QUALITIES) {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/webp", quality);
    });
    if (blob && blob.size <= maxBytes) {
      const name = file.name.replace(/\.[^.]+$/, "");
      return new File([blob], `${name}.webp`, { type: "image/webp" });
    }
  }

  return null;
}

/**
 * Políčko pro výběr souboru, které velikost vyřeší hned po vybrání. Velké fotky
 * zmenší, ostatní velké soubory odmítne s vysvětlením — nahrávat se pak zkouší
 * jen to, co má šanci projít. Kontrola na serveru zůstává, tohle je pohodlí,
 * ne zabezpečení.
 */
export function UploadField({
  id = "file",
  name = "file",
  label,
  hint,
  required = false,
  className,
}: {
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    setNote(null);
    setError(null);
    if (!file) return;

    const plan = planUpload(file, MAX_UPLOAD_BYTES);

    if (plan.action === "upload") return;

    if (plan.action === "refuse") {
      input.value = "";
      setError(plan.reason);
      return;
    }

    setWorking(true);
    const shrunk = await shrinkImage(file, MAX_UPLOAD_BYTES);
    setWorking(false);

    if (!shrunk) {
      input.value = "";
      setError(
        `Fotku o ${megabytes(file.size)} se nepodařilo zmenšit pod ${megabytes(MAX_UPLOAD_BYTES)}. Zmenšete ji prosím sám.`,
      );
      return;
    }

    // Vybraný soubor nahradíme zmenšeným, aby se odeslal ten menší.
    const transfer = new DataTransfer();
    transfer.items.add(shrunk);
    input.files = transfer.files;

    setNote(
      `Fotka byla zmenšena z ${megabytes(file.size)} na ${megabytes(shrunk.size)}, aby se vešla do limitu.`,
    );
  }

  return (
    <div className="space-y-1.5">
      {label ? (
        <label
          htmlFor={id}
          className="block text-sm font-medium text-slate-700"
        >
          {label}
        </label>
      ) : null}

      <input
        id={id}
        name={name}
        type="file"
        required={required}
        onChange={handleChange}
        // Dialog umí filtrovat jen podle typu, velikost pohlídáme až po vybrání.
        accept={ALLOWED_MIME_TYPES.join(",")}
        aria-label={label ? undefined : "Soubor"}
        className={
          className ??
          "w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-sm"
        }
      />

      {working ? (
        <p className="text-xs text-slate-500">Zmenšuji fotku…</p>
      ) : null}
      {note ? <p className="text-xs text-emerald-700">{note}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

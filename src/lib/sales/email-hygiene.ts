/**
 * Hygiena nalezených e-mailových adres. Weby píšou adresy typograficky —
 * nedělitelné pomlčky, ozdobné zavináče — a přepsaná adresa by tiše
 * nedoručila. Čistý modul kvůli testům.
 */

/** Typografické pomlčky a mínusy, které se na webech pletou za spojovník. */
const DASHES = /[‐‑‒–—―−]/g;

/**
 * Znormalizuje nalezenou adresu, nebo vrátí null, když to adresa není.
 * Po náhradě pomlček musí zbýt čisté ASCII — exotická adresa je spíš chybný
 * přepis než skutečná schránka a radši se zahodí, než aby se na ni psalo.
 */
export function normalizeFoundEmail(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(DASHES, "-")
    .replace(/\s+/g, "");

  if (!/^[\x21-\x7e]+$/.test(cleaned)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) return null;

  return cleaned;
}

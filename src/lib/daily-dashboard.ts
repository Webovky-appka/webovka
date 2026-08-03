/**
 * Sdílené kusy denního přehledu. Bez "use client" — jméno cookie čte server
 * (rozhoduje, zda přehled vůbec vykreslit) i klient (zápis při zavření).
 * Export z klientské komponenty by na serveru nebyl řetězec, ale klientská
 * reference, a porovnání s cookie by tiše nikdy nesedělo.
 */

/** Cookie s hodnotou dne, kdy byl přehled zavřen. Ráno se ukáže znovu. */
export const DASHBOARD_DISMISS_COOKIE = "denni-prehled-zavren";

export type DashboardItem = {
  label: string;
  href: string;
  /** Doplněk vpravo — skóre, termín, počet dní. */
  meta?: string;
  /** Zvýraznění mety (po termínu, vysoké skóre). */
  metaTone?: "default" | "alert" | "good";
};

export type DashboardSection = {
  key: string;
  title: string;
  count: number;
  /** Kam vede „vše" — když je položek víc, než se vešlo. */
  href: string;
  items: DashboardItem[];
  tone: "emerald" | "sky" | "amber" | "slate";
};

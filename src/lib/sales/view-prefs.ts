/**
 * Co si prohlížeč pamatuje o zobrazení AI Sales. Rozbalené sekce se ukládají
 * do cookie, ne do adresy: uživatel na ně nemá klikat po každém návratu
 * a odkaz s `?zamitnute=1` navíc rozbíjel i poslání URL kolegovi.
 *
 * Čistý modul bez server-only — konstanty potřebuje server action i stránka.
 */

export const SHOW_REJECTED_COOKIE = "sales_zamitnute";
export const SHOW_ARCHIVED_COOKIE = "sales_archiv";

/** Rok: jde o pohodlí, ne o nic citlivého. */
export const VIEW_PREF_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cookie je zapnutá jen na explicitní „1". Cokoli jiného (chybí, prázdná,
 * pozůstatek po staré verzi) znamená sbaleno — výchozí stav má být klidný.
 */
export function isPrefOn(value: string | undefined): boolean {
  return value === "1";
}

/**
 * Deduplikace a cooldown (sekce 27 specifikace): stejné firmě se nesmí posílat
 * opakovaný cold outreach. Čisté funkce bez databáze, ať se dají testovat —
 * data jim předává Scout.
 */

/** Po zamítnutí nebo prohře se firma nechává na pokoji půl roku. */
export const COOLDOWN_DAYS = 180;

/**
 * Doména jako deduplikační klíč: bez protokolu, bez www, bez cesty, malými
 * písmeny. Vrací null pro hodnoty, které doménou nejsou — ty se dedupují
 * podle názvu firmy.
 */
export function normalizeDomain(value: string | null | undefined): string | null {
  if (!value) return null;

  let host = value.trim().toLowerCase();
  if (host === "") return null;

  // URL bez protokolu parser nezvládne, doplníme ho.
  try {
    const url = new URL(host.includes("://") ? host : `https://${host}`);
    host = url.hostname;
  } catch {
    return null;
  }

  host = host.replace(/^www\./, "");

  // IP adresy a lokální jména nejsou weby firem — a fetch na ně nechceme.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  if (host === "localhost" || host.endsWith(".local") || !host.includes(".")) {
    return null;
  }

  return host;
}

export type ExistingLeadInfo = {
  status: string;
  updatedAt: Date;
};

export type DedupeDecision =
  | { action: "create" }
  | { action: "skip"; reason: string };

/**
 * Rozhodne, jestli se smí založit nový lead. Firma se přeskakuje, když je
 * naším klientem, když má rozpracovaný nebo oslovený lead, a když je
 * v cooldownu po zamítnutí či prohře.
 */
export function dedupeDecision({
  isClient,
  existingLeads,
  now = new Date(),
  cooldownDays = COOLDOWN_DAYS,
}: {
  isClient: boolean;
  existingLeads: ExistingLeadInfo[];
  now?: Date;
  cooldownDays?: number;
}): DedupeDecision {
  if (isClient) {
    return { action: "skip", reason: "už je naším klientem" };
  }

  const closed = new Set(["REJECTED", "LOST"]);
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;

  for (const lead of existingLeads) {
    if (!closed.has(lead.status)) {
      return {
        action: "skip",
        reason: `už má rozpracovaný lead (${lead.status})`,
      };
    }
  }

  for (const lead of existingLeads) {
    const age = now.getTime() - lead.updatedAt.getTime();
    if (age < cooldownMs) {
      const days = Math.ceil((cooldownMs - age) / (24 * 60 * 60 * 1000));
      return {
        action: "skip",
        reason: `v cooldownu po ${lead.status === "LOST" ? "prohře" : "zamítnutí"}, zbývá ${days} dní`,
      };
    }
  }

  return { action: "create" };
}

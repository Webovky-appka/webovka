/**
 * Deduplikace a cooldown (sekce 27 specifikace): stejné firmě se nesmí posílat
 * opakovaný cold outreach. Čisté funkce bez databáze, ať se dají testovat —
 * data jim předává Scout.
 */

/** Po zamítnutí nebo prohře se firma nechává na pokoji půl roku. */
export const COOLDOWN_DAYS = 180;

/**
 * Sdílené platformy: samotná doména tu podnik neidentifikuje, identita je až
 * v cestě (facebook.com/nazevpodniku). Matchují se i subdomény, takže položka
 * facebook.com pokrývá i m.facebook.com nebo cs-cz.facebook.com. Firmy jen
 * s takovou stránkou jsou obchodně nejcennější kandidáti — bez vlastního webu.
 */
export const SHARED_PLATFORM_DOMAINS = [
  "facebook.com",
  "fb.com",
  "fb.me",
  "m.me",
  "instagram.com",
  "tiktok.com",
  "youtube.com",
  "linktr.ee",
  "google.com",
  "goo.gl",
  "g.page",
  "firmy.cz",
  "mapy.cz",
  "zlatestranky.cz",
] as const;

/**
 * Parametry dotazu, které na sdílené platformě nesou identitu stránky
 * (facebook.com/profile.php?id=…, mapy.cz ?id=…). Ostatní parametry jsou šum.
 */
const SHARED_IDENTITY_PARAMS = ["id", "cid"] as const;

function parseUrl(value: string | null | undefined): URL | null {
  if (!value) return null;

  const input = value.trim().toLowerCase();
  if (input === "") return null;

  // URL bez protokolu parser nezvládne, doplníme ho.
  try {
    return new URL(input.includes("://") ? input : `https://${input}`);
  } catch {
    return null;
  }
}

/**
 * Zrcadlové subdomény (www, m, mobile) servírují tytéž stránky, tak se
 * odřezávají. Lookahead hlídá, aby z krátkých domén typu m.me nezbylo torzo.
 */
function cleanHost(url: URL): string {
  return url.hostname.replace(/^((?:www|m|mobile)\.)+(?=.+\.)/, "");
}

function sharedPlatformBase(host: string): string | null {
  return (
    SHARED_PLATFORM_DOMAINS.find(
      (base) => host === base || host.endsWith(`.${base}`),
    ) ?? null
  );
}

/** Poznává URL sdílených platforem — kvůli srozumitelnému důvodu přeskočení. */
export function isSharedPlatformUrl(value: string | null | undefined): boolean {
  const url = parseUrl(value);
  return url !== null && sharedPlatformBase(cleanHost(url)) !== null;
}

/**
 * Poznává už znormalizovanou doménu sdílené platformy uloženou na prospektu
 * (facebook.com/nazevpodniku). Taková firma nemá vlastní web: audit se
 * přeskakuje a e-mail nabízí první web, ne redesign.
 */
export function isSharedPlatformDomain(
  domain: string | null | undefined,
): boolean {
  if (!domain) return false;
  const host = domain.split(/[/?]/)[0] ?? "";
  return sharedPlatformBase(host) !== null;
}

/**
 * Deduplikační klíč z adresy webu: bez protokolu, bez www, malými písmeny.
 * U běžných firemních webů jen doména. U sdílených platforem doména plus
 * cesta ke stránce podniku, protože doména sama je společná tisícům firem.
 * Vrací null pro hodnoty, které podnik neidentifikují — pro root sdílené
 * platformy i pro věci, které doménou vůbec nejsou.
 */
export function normalizeDomain(value: string | null | undefined): string | null {
  const url = parseUrl(value);
  if (!url) return null;

  const host = cleanHost(url);

  // IP adresy a lokální jména nejsou weby firem — a fetch na ně nechceme.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return null;
  if (host === "localhost" || host.endsWith(".local") || !host.includes(".")) {
    return null;
  }

  if (sharedPlatformBase(host) === null) return host;

  const segments = url.pathname
    .split("/")
    .filter((segment) => segment !== "")
    // Šum z mapových URL: souřadnice a datové bloby nejsou identita podniku.
    .filter((segment) => !segment.startsWith("@") && !segment.startsWith("data="));

  const params = new URLSearchParams();
  for (const name of SHARED_IDENTITY_PARAMS) {
    const paramValue = url.searchParams.get(name);
    if (paramValue) params.set(name, paramValue);
  }

  const path = segments.join("/");
  const query = params.toString();
  if (path === "" && query === "") return null;

  return `${host}${path === "" ? "" : `/${path}`}${query === "" ? "" : `?${query}`}`;
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

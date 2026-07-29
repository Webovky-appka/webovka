const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

/**
 * Termíny jsou kalendářní dny, ne okamžiky. Z formuláře přicházejí jako
 * "2026-07-26" a JavaScript je parsuje na midnight v UTC, takže se musí i
 * formátovat v UTC — jinak by se v zónách za UTC zobrazil den zpátky.
 */
const dayFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const dayShortFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  timeZone: "UTC",
});

const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Pro okamžiky — kdy byl záznam vytvořen, kdy klient schválil. */
export function formatDate(value: Date | null | undefined): string {
  return value ? dateFormatter.format(value) : "—";
}

/** Pro kalendářní dny — termíny zadané ve formuláři. */
export function formatDay(value: Date | null | undefined): string {
  return value ? dayFormatter.format(value) : "—";
}

/** Kalendářní den bez roku, pro úsporu místa na nástěnce úkolů. */
export function formatDayShort(value: Date | null | undefined): string {
  return value ? dayShortFormatter.format(value) : "—";
}

export function formatDateTime(value: Date | null | undefined): string {
  return value ? dateTimeFormatter.format(value) : "—";
}

/** Relativní popis pro "poslední kontakt" — přesné datum je vždy v titulku. */
export function formatRelativeDays(value: Date | null | undefined): string {
  if (!value) return "žádný kontakt";

  const days = Math.floor((Date.now() - value.getTime()) / 86_400_000);
  if (days <= 0) return "dnes";
  if (days === 1) return "včera";
  if (days < 7) return `před ${days} dny`;
  if (days < 14) return "před týdnem";
  if (days < 60) return `před ${Math.floor(days / 7)} týdny`;
  return `před ${Math.floor(days / 30)} měsíci`;
}

/** České skloňování podle počtu: 1, 2–4, 5 a více. */
export function pluralCs(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count === 1) return one;
  if (count >= 2 && count <= 4) return few;
  return many;
}

/** Celá věta včetně shody přísudku — „zbývají 3 nehotové úkoly". */
export function unfinishedTasksPhrase(count: number): string {
  return pluralCs(
    count,
    `zbývá ${count} nehotový úkol`,
    `zbývají ${count} nehotové úkoly`,
    `zbývá ${count} nehotových úkolů`,
  );
}

/** Klient, u kterého se dlouho nic nedělo. Prahová hodnota je ve dnech. */
export function isContactStale(
  value: Date | null | undefined,
  days = 14,
): boolean {
  if (!value) return false;
  return Date.now() - value.getTime() > days * 86_400_000;
}

/** Aplikace je česká, takže "dnes" se řídí českým kalendářem, ne zónou serveru. */
const BUSINESS_TIME_ZONE = "Europe/Prague";

const businessDayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: BUSINESS_TIME_ZONE,
});

/** Kalendářní den v UTC jako číslo YYYYMMDD, aby šly dny porovnat bez zóny. */
function utcDayNumber(value: Date): number {
  return (
    value.getUTCFullYear() * 10_000 +
    (value.getUTCMonth() + 1) * 100 +
    value.getUTCDate()
  );
}

/** Dnešní den podle českého kalendáře, ve stejném tvaru YYYYMMDD. */
function businessTodayNumber(now: Date): number {
  // en-CA dává YYYY-MM-DD, takže stačí odstranit pomlčky.
  return Number(businessDayFormatter.format(now).replaceAll("-", ""));
}

/**
 * Termín je po datu. Termíny z formuláře jsou uložené jako midnight v UTC,
 * takže se čte jejich UTC den; "dnes" se naopak bere podle českého kalendáře.
 * Porovnávání v zóně serveru by v jiné zóně hlásilo "po termínu" o den dřív.
 */
export function isOverdue(dueDate: Date | null | undefined): boolean {
  if (!dueDate) return false;
  return utcDayNumber(dueDate) < businessTodayNumber(new Date());
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

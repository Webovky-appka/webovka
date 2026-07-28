const dateFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(value: Date | null | undefined): string {
  return value ? dateFormatter.format(value) : "—";
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

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

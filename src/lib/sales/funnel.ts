/**
 * Funnel podle sekce 45 specifikace: cesta od kandidáta ke klientovi.
 * Čistý modul — dostane počty leadů podle stavu, vrátí kumulativní trychtýř
 * a poměry. Stavy jsou seřazené, takže aktuální stav leadu říká, kam nejdál
 * došel.
 *
 * Zjednodušení, vědomé: LOST znamená „došel aspoň k oslovení a pak to padlo“ —
 * kde přesně, ze stavu nepoznáme, tak se LOST počítá do reached u CONTACTED
 * a dál ne. REJECTED je zamítnutí před oslovením a do trychtýře od oslovení
 * dál nepatří.
 */

export type StatusCounts = Partial<Record<string, number>>;

/** Pořadí stavů na cestě ke klientovi. */
const LADDER = [
  "DISCOVERED",
  "QUALIFYING",
  "QUALIFIED",
  "RESEARCHING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "PROPOSAL",
  "WON",
] as const;

export type FunnelStage = {
  key: string;
  label: string;
  /** Kolik leadů došlo aspoň sem. */
  reached: number;
};

const STAGE_LABELS: Record<string, string> = {
  DISCOVERED: "Objevení",
  QUALIFIED: "Kvalifikovaní",
  READY_FOR_REVIEW: "Ke schválení",
  CONTACTED: "Oslovení",
  REPLIED: "Odpověděli",
  MEETING: "Schůzky",
  PROPOSAL: "Nabídky",
  WON: "Vyhráno",
};

/** Stavy zobrazené v trychtýři — mezistavy běhu se přeskakují. */
const VISIBLE_STAGES = [
  "DISCOVERED",
  "QUALIFIED",
  "READY_FOR_REVIEW",
  "CONTACTED",
  "REPLIED",
  "MEETING",
  "PROPOSAL",
  "WON",
] as const;

function countAtLeast(counts: StatusCounts, stage: string): number {
  const from = LADDER.indexOf(stage as (typeof LADDER)[number]);
  let total = 0;

  for (let i = from; i < LADDER.length; i += 1) {
    total += counts[LADDER[i]] ?? 0;
  }

  // LOST prošel oslovením; REJECTED prošel objevením a kvalifikací ne nutně —
  // zamítá se před schválením i při něm, tak se počítá jen do objevených.
  const lost = counts.LOST ?? 0;
  const rejected = counts.REJECTED ?? 0;
  if (from <= LADDER.indexOf("CONTACTED")) total += lost;
  if (stage === "DISCOVERED") total += rejected;

  return total;
}

export type Funnel = {
  stages: FunnelStage[];
  won: number;
  lost: number;
  rejected: number;
  replyRate: number | null;
  meetingRate: number | null;
  closeRate: number | null;
};

export function computeFunnel(counts: StatusCounts): Funnel {
  const stages = VISIBLE_STAGES.map((key) => ({
    key,
    label: STAGE_LABELS[key] ?? key,
    reached: countAtLeast(counts, key),
  }));

  const reached = (key: string) =>
    stages.find((stage) => stage.key === key)?.reached ?? 0;

  const contacted = reached("CONTACTED");
  const replied = reached("REPLIED");
  const meetings = reached("MEETING");
  const won = counts.WON ?? 0;

  const rate = (part: number, whole: number): number | null =>
    whole === 0 ? null : Math.round((part / whole) * 100);

  return {
    stages,
    won,
    lost: counts.LOST ?? 0,
    rejected: counts.REJECTED ?? 0,
    replyRate: rate(replied, contacted),
    meetingRate: rate(meetings, replied),
    closeRate: rate(won, contacted),
  };
}

/**
 * Stavy, ve kterých smí člověk pustit kompletní proskenování (audit,
 * kontakty, research, koncept, návrh e-mailu). Po oslovení už ne — rescan
 * zahazuje rozpracovaný návrh a u odeslaného e-mailu by přepsal historii.
 */
const RESCAN_STATUSES = new Set([
  "DISCOVERED",
  "QUALIFYING",
  "QUALIFIED",
  "RESEARCHING",
  "READY_FOR_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "REJECTED",
]);

export function canRescan(status: string): boolean {
  return RESCAN_STATUSES.has(status);
}

/**
 * Odvolat odeslání jde jen z čerstvě oslovené příležitosti. U posunutých
 * stavů (odpověděli, schůzka, nabídka) se nejdřív vrací výsledek na
 * „Oslovená“, ať se nepřepisuje víc kroků jedním kliknutím.
 */
export function canUndoSend(status: string): boolean {
  return status === "CONTACTED";
}

/** Důvody prohry podle sekce 29 specifikace. */
export const LOST_REASONS = [
  "Příliš drahé",
  "Už mají agenturu",
  "Nemají zájem",
  "Špatné načasování",
  "Bez rozpočtu",
  "Jiný důvod",
] as const;

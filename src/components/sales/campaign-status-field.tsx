"use client";

import { SalesCampaignStatus } from "@prisma/client";

import { setCampaignStatus } from "@/app/actions/sales";
import { AutoSubmitSelect, SaveIndicator } from "@/components/auto-save";

const STATUS_LABELS: Record<SalesCampaignStatus, string> = {
  ACTIVE: "Aktivní",
  PAUSED: "Pozastavená",
  ARCHIVED: "Archivovaná",
};

/** Stav kampaně, ukládá se hned při přepnutí. Pozastavená kampaň neběží. */
export function CampaignStatusField({
  campaignId,
  status,
}: {
  campaignId: string;
  status: SalesCampaignStatus;
}) {
  return (
    <form action={setCampaignStatus} className="flex items-center gap-2">
      <input type="hidden" name="campaignId" value={campaignId} />
      <AutoSubmitSelect
        name="status"
        defaultValue={status}
        ariaLabel="Stav kampaně"
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        options={(Object.keys(STATUS_LABELS) as SalesCampaignStatus[]).map(
          (value) => ({ value, label: STATUS_LABELS[value] }),
        )}
      />
      <SaveIndicator />
    </form>
  );
}

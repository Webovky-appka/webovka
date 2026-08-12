"use client";

import { setCampaignSchedule } from "@/app/actions/sales";
import { AutoSubmitSelect, SaveIndicator } from "@/components/auto-save";

const SCHEDULE_LABELS: Record<string, string> = {
  NONE: "Jen ručně",
  WEEKDAYS: "Každý pracovní den ráno",
  DAILY: "Každý den ráno",
};

/**
 * Automatické spouštění se ukládá hned při přepnutí — jako stav kampaně
 * a ostatní stavy v aplikaci. Dřív bylo schované v hlavním formuláři, takže
 * kdo nezmáčkl Uložit kampaň, viděl při dalším pohledu zase „Jen ručně“
 * a vypadalo to, že se nastavení neuložilo.
 */
export function CampaignScheduleField({
  campaignId,
  schedule,
}: {
  campaignId: string;
  schedule: string;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-slate-700">Automatické spouštění</p>
      <form action={setCampaignSchedule} className="flex items-center gap-2">
        <input type="hidden" name="campaignId" value={campaignId} />
        <AutoSubmitSelect
          name="schedule"
          defaultValue={schedule}
          ariaLabel="Automatické spouštění kampaně"
          className="max-w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          options={Object.entries(SCHEDULE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <SaveIndicator />
      </form>
      <p className="text-xs text-slate-500">
        Běh startuje kolem 8:00. Ráno pak čekají příležitosti ke schválení.
        Ukládá se hned, tlačítko není potřeba.
      </p>
    </div>
  );
}

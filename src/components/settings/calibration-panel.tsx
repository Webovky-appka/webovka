"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  clearWebsiteRating,
  rateWebsite,
  type SalesFormState,
} from "@/app/actions/sales";
import { FormError } from "@/components/field";
import {
  CALIBRATION_LIMIT,
  gradeFor,
  HUMAN_GRADES,
  pickCalibrationExamples,
} from "@/lib/sales/human-grades";

export type RatedWebsite = {
  leadId: string;
  companyName: string;
  domain: string | null;
  humanWebScore: number;
  humanWebNote: string | null;
  modelScore: number | null;
  hasScreenshot: boolean;
  campaignName: string;
};

/** Jeden vzor: náhled, známka, poznámka a možnost obojí přepsat. */
function RatedRow({
  item,
  inUse,
}: {
  item: RatedWebsite;
  inUse: boolean;
}) {
  const [rated, rateAction, rating] = useActionState<SalesFormState, FormData>(
    rateWebsite,
    undefined,
  );
  const [cleared, clearAction, clearing] = useActionState<
    SalesFormState,
    FormData
  >(clearWebsiteRating, undefined);
  const grade = gradeFor(item.humanWebScore);

  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row">
      <div className="w-full shrink-0 sm:w-44">
        {item.hasScreenshot ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/sales/screenshots/${item.leadId}/desktop`}
            alt={`Snímek webu ${item.companyName}`}
            className="w-full rounded-lg border border-slate-200"
          />
        ) : (
          <div className="flex h-24 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
            snímek chybí
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link
            href={`/sales/leads/${item.leadId}`}
            className="text-sm font-medium text-slate-900 hover:underline"
          >
            {item.companyName}
          </Link>
          {item.domain ? (
            <a
              href={`https://${item.domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-700 hover:underline"
            >
              {item.domain} ↗
            </a>
          ) : null}
          <span className="text-xs text-slate-400">{item.campaignName}</span>
          {inUse ? (
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs text-sky-800 ring-1 ring-sky-100">
              používá se při auditu
            </span>
          ) : null}
        </div>

        <p className="text-sm text-slate-700">
          <span className="font-medium">
            {grade.label} ({item.humanWebScore})
          </span>
          {item.modelScore !== null ? (
            <span className="text-slate-400"> · model dal {item.modelScore}</span>
          ) : null}
        </p>

        {item.humanWebNote ? (
          <p className="text-xs text-slate-600">„{item.humanWebNote}“</p>
        ) : null}

        <form action={rateAction} className="space-y-2">
          <input type="hidden" name="leadId" value={item.leadId} />
          <div className="flex flex-wrap gap-1.5">
            {HUMAN_GRADES.map((option) => (
              <button
                key={option.score}
                type="submit"
                name="score"
                value={option.score}
                disabled={rating}
                title={option.hint}
                className={`rounded-lg border px-2 py-1 text-xs transition disabled:opacity-60 ${
                  option.score === grade.score
                    ? "border-sky-300 bg-sky-50 font-medium text-sky-900"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="text"
            name="note"
            maxLength={200}
            defaultValue=""
            placeholder={
              item.humanWebNote
                ? "Přepsat poznámku (prázdné = zůstane stará)"
                : "Nepovinně: čím si tu známku vysloužil"
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-400"
          />
          <FormError message={rated?.error} />
          {rated?.success ? (
            <p className="text-xs text-emerald-700">{rated.success}</p>
          ) : null}
        </form>

        <form action={clearAction}>
          <input type="hidden" name="leadId" value={item.leadId} />
          <button
            type="submit"
            disabled={clearing}
            className="text-xs text-slate-500 underline-offset-2 hover:text-red-700 hover:underline disabled:opacity-60"
          >
            {clearing ? "Odebírám…" : "Odebrat ze vzorů"}
          </button>
          <FormError message={cleared?.error} />
        </form>
      </div>
    </li>
  );
}

/**
 * Sbírka webů, které jste ohodnotil — přesně to, co model dostane před
 * každým auditem. Vzory se berou rozprostřené po škále, takže tady je vidět
 * i které z nich se právě používají.
 */
export function CalibrationPanel({ items }: { items: RatedWebsite[] }) {
  const usable = items.filter((item) => item.hasScreenshot);
  const inUse = new Set(
    pickCalibrationExamples(
      usable.map((item) => ({ id: item.leadId, humanWebScore: item.humanWebScore })),
    ).map((item) => item.id),
  );

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Vzory hodnocení webů (kalibrace auditu)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Weby, které jste ohodnotil vlastní známkou. Před každým auditem
          dostane model {CALIBRATION_LIMIT} z nich jako snímky se vaší známkou —
          vybrané napříč škálou, aby viděl oba konce laťky, ne jen průměr.
          Hodnotí se u příležitosti pod snímky webu.
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Zatím žádné hodnocení. Otevřete příležitost, projděte snímky webu a dejte
          mu známku — od druhého hodnocení se audity začnou srovnávat podle vás.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <RatedRow
                key={item.leadId}
                item={item}
                inUse={inUse.has(item.leadId)}
              />
            ))}
          </ul>
          <p className="text-xs text-slate-400">
            {items.length}{" "}
            {items.length === 1
              ? "ohodnocený web"
              : items.length < 5
                ? "ohodnocené weby"
                : "ohodnocených webů"}
            {usable.length < items.length
              ? ` · ${items.length - usable.length} bez snímku, ty se do auditu poslat nedají`
              : ""}
          </p>
        </>
      )}
    </section>
  );
}

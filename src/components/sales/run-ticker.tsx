"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Snapshot = {
  status: string;
  stats: {
    inspected?: number;
    created?: number;
    qualified?: number;
    rejected?: number;
    overLimit?: number;
    skipped?: { name: string; reason: string }[];
    errors?: string[];
  };
};

/** Po jaké době bez pokroku stránka běh kopne, kdyby řetěz ticků umřel. */
const KICK_AFTER_MS = 20_000;

/**
 * Živý stav běhu. Práci si řetězí server sám; tahle komponenta stav jen čte
 * a slouží jako pojistka — když se dlouho nic neděje (typicky po restartu
 * serveru, který řetěz přetrhl), pošle jeden tick a řetěz tím naváže.
 */
export function RunTicker({ runId }: { runId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 0 = zatím nic neviděno; skutečný čas se nastaví až v efektu, render musí
  // zůstat čistý.
  const lastChange = useRef(0);
  const lastSeen = useRef("");

  useEffect(() => {
    let stopped = false;
    lastChange.current = Date.now();

    async function kick() {
      try {
        await fetch(`/api/sales/runs/${runId}/tick`, { method: "POST" });
      } catch {
        // Pojistka smí selhat potichu, další pokus přijde za KICK_AFTER_MS.
      }
    }

    async function poll() {
      while (!stopped) {
        try {
          const response = await fetch(`/api/sales/runs/${runId}/tick`, {
            cache: "no-store",
          });
          if (!response.ok) {
            setError(`Čtení stavu selhalo (HTTP ${response.status}).`);
            return;
          }

          const data = (await response.json()) as Snapshot;
          if (stopped) return;
          setSnapshot(data);

          if (data.status === "COMPLETED" || data.status === "FAILED") {
            router.refresh();
            return;
          }

          const fingerprint = JSON.stringify(data.stats);
          if (fingerprint !== lastSeen.current) {
            lastSeen.current = fingerprint;
            lastChange.current = Date.now();
          } else if (Date.now() - lastChange.current > KICK_AFTER_MS) {
            lastChange.current = Date.now();
            void kick();
          }
        } catch {
          setError("Spojení se serverem selhalo. Obnovte stránku.");
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, 2_500));
      }
    }

    // První kopnutí hned — čerstvě založený běh nemá řetěz, tenhle ho spustí.
    void kick();
    void poll();

    return () => {
      stopped = true;
    };
  }, [runId, router]);

  const stats = snapshot?.stats;

  return (
    <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex items-center gap-2">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-sky-600" />
        </span>
        <p className="text-sm font-medium text-sky-900">
          {snapshot === null
            ? "Načítám stav běhu…"
            : !stats?.inspected
              ? "Scout hledá kandidáty…"
              : "Kvalifikuji leady…"}
        </p>
      </div>

      {stats ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-sky-900 sm:grid-cols-5">
          <div>
            <dt className="text-xs text-sky-700">Prohlédnuto</dt>
            <dd className="font-medium">{stats.inspected ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Založeno</dt>
            <dd className="font-medium">{stats.created ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Kvalifikováno</dt>
            <dd className="font-medium">{stats.qualified ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Zamítnuto</dt>
            <dd className="font-medium">{stats.rejected ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Přeskočeno</dt>
            <dd className="font-medium">{stats.skipped?.length ?? 0}</dd>
          </div>
        </dl>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p className="text-xs text-sky-700">
          Běh pokračuje i se zavřenou stránkou — server si kroky řetězí sám.
        </p>
      )}
    </div>
  );
}

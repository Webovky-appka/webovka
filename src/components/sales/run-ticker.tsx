"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Snapshot = {
  status: string;
  pending: number;
  stats: {
    inspected: number;
    created: number;
    qualified: number;
    rejected: number;
    overLimit: number;
    skipped: { name: string; reason: string }[];
    errors: string[];
    log: { at: string; text: string }[];
  };
};

/**
 * Krokuje běh, dokud neskončí: každý požadavek na tick udělá kus práce na
 * serveru a vrátí stav. Pracovníkem je tahle otevřená stránka — když ji
 * zavřete, běh se zastaví a pokračuje při příštím otevření.
 */
export function RunTicker({ runId }: { runId: string }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;

    async function loop() {
      while (!stopped.current) {
        let response: Response;
        try {
          response = await fetch(`/api/sales/runs/${runId}/tick`, {
            method: "POST",
          });
        } catch {
          setError("Spojení se serverem selhalo. Obnovte stránku.");
          return;
        }

        if (!response.ok) {
          setError(`Krok běhu selhal (HTTP ${response.status}).`);
          return;
        }

        const data = (await response.json()) as Snapshot;
        if (stopped.current) return;
        setSnapshot(data);

        if (data.status === "COMPLETED" || data.status === "FAILED") {
          router.refresh();
          return;
        }
      }
    }

    void loop();
    return () => {
      stopped.current = true;
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
            ? "Spouštím běh…"
            : !stats?.inspected && snapshot.status === "RUNNING"
              ? "Scout hledá kandidáty…"
              : snapshot.pending > 0
                ? `Kvalifikuji leady, zbývá ${snapshot.pending}…`
                : "Dokončuji…"}
        </p>
      </div>

      {stats ? (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-sky-900 sm:grid-cols-5">
          <div>
            <dt className="text-xs text-sky-700">Prohlédnuto</dt>
            <dd className="font-medium">{stats.inspected}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Založeno</dt>
            <dd className="font-medium">{stats.created}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Kvalifikováno</dt>
            <dd className="font-medium">{stats.qualified}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Zamítnuto</dt>
            <dd className="font-medium">{stats.rejected}</dd>
          </div>
          <div>
            <dt className="text-xs text-sky-700">Přeskočeno</dt>
            <dd className="font-medium">{stats.skipped.length}</dd>
          </div>
        </dl>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : (
        <p className="text-xs text-sky-700">
          Nechte stránku otevřenou — běh krokuje právě ona.
        </p>
      )}
    </div>
  );
}

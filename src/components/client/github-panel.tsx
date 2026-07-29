import { setProjectRepo } from "@/app/actions/projects";
import { AutoSaveInput, SaveIndicator } from "@/components/auto-save";
import { formatDateTime, formatRelativeDays } from "@/lib/format";
import {
  isGithubConfigured,
  repoOverview,
  repoUrl,
  runLabel,
  runTone,
  type RepoOverview,
} from "@/lib/github";

/**
 * Repozitář zakázky. Čte se přes jeden token studia, takže tady nikdo nemusí
 * nic připojovat — kdo vidí zakázku, vidí i její kód.
 */
export async function GithubPanel({
  projectId,
  repoFullName,
}: {
  projectId: string;
  repoFullName: string | null;
}) {
  const configured = isGithubConfigured();
  const overview =
    repoFullName && configured ? await repoOverview(repoFullName) : null;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">GitHub</h2>
          <p className="mt-1 text-xs text-slate-500">
            Posledních pět commitů, otevřené pull requesty a poslední běh
            Actions. Jen čtení, aplikace do repozitáře nezapisuje.
          </p>
        </div>
        {repoFullName ? (
          <a
            href={repoUrl(repoFullName)}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-sm text-sky-700 underline hover:text-sky-900"
          >
            Otevřít na GitHubu
          </a>
        ) : null}
      </div>

      <form action={setProjectRepo} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="projectId" value={projectId} />
        <label
          htmlFor={`repo-${projectId}`}
          className="text-sm text-slate-600"
        >
          Repozitář
        </label>
        <AutoSaveInput
          name="repo"
          defaultValue={repoFullName ?? ""}
          ariaLabel="Repozitář zakázky ve tvaru owner/repo"
          placeholder="owner/repo"
          allowEmpty
          className="min-w-56 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none placeholder:text-slate-400 hover:border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
        />
        <SaveIndicator />
      </form>

      {!configured ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Chybí GITHUB_TOKEN. Bez něj se privátní repozitář nepřečte — postup je
          v DEPLOYMENT.md.
        </p>
      ) : !repoFullName ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Vyplňte repozitář a přehled se načte. Vložit jde i celá adresa z
          prohlížeče.
        </p>
      ) : overview && "error" in overview ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {overview.error}
        </p>
      ) : overview ? (
        <Overview data={overview} />
      ) : null}
    </section>
  );
}

function Overview({ data }: { data: RepoOverview }) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-800",
    error: "bg-red-50 text-red-700",
    neutral: "bg-slate-100 text-slate-600",
  } as const;

  return (
    <div className="space-y-4">
      {data.run ? (
        <a
          href={data.run.url}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex flex-wrap items-center gap-2 rounded-lg px-3 py-1.5 text-xs ${tones[runTone(data.run)]}`}
        >
          <span className="font-medium">Actions: {runLabel(data.run)}</span>
          <span className="opacity-80">
            {data.run.name}
            {data.run.branch ? ` · ${data.run.branch}` : ""} ·{" "}
            {formatRelativeDays(data.run.createdAt)}
          </span>
        </a>
      ) : data.runsUnavailable ? (
        <p className="text-xs text-slate-400">
          Stav Actions se nepodařilo přečíst — token na to nemá oprávnění.
        </p>
      ) : null}

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase">
          Poslední commity
        </h3>
        {data.commits.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">Žádný commit.</p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 text-sm">
            {data.commits.map((commit) => (
              <li key={commit.sha} className="py-2">
                <a
                  href={commit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 hover:underline"
                >
                  {commit.message || "(bez zprávy)"}
                </a>
                <p className="text-xs text-slate-500">
                  <code className="text-slate-400">{commit.sha}</code> ·{" "}
                  {commit.author} · {formatDateTime(commit.date)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold text-slate-500 uppercase">
          Otevřené pull requesty
        </h3>
        {data.pulls.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">
            Žádný otevřený pull request.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-slate-100 text-sm">
            {data.pulls.map((pull) => (
              <li key={pull.number} className="py-2">
                <a
                  href={pull.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-900 hover:underline"
                >
                  #{pull.number} {pull.title}
                </a>
                <p className="text-xs text-slate-500">
                  {pull.draft ? "rozpracovaný · " : ""}
                  {pull.author} · aktualizováno{" "}
                  {formatRelativeDays(pull.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

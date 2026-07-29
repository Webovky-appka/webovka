import "server-only";

/**
 * Čtení z GitHubu. Jen čtení — aplikace do repozitáře nikdy nezapisuje.
 *
 * Token je jeden, studijní (fine-grained PAT v GITHUB_TOKEN), ne per uživatel.
 * Pro privátní repozitáře je povinný, u veřejných by bez něj došla kvóta po
 * šedesáti dotazech za hodinu. Odpovědi držíme dvě minuty v cache, ať se
 * přepínáním záložek kvóta nevyčerpá.
 */
const API_URL = "https://api.github.com";
const CACHE_SECONDS = 120;
const PER_PAGE = 5;

export function isGithubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

/**
 * Vytáhne owner/repo z toho, co člověk vloží — celé adresy, ssh remote i
 * samotného owner/repo. Vrací null, když to na repozitář nevypadá.
 */
export function parseRepo(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const withoutProtocol = trimmed
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/^github\.com\//i, "");

  const [owner, repoPart] = withoutProtocol.split("/");
  if (!owner || !repoPart) return null;

  // Z adresy typu .../repo/tree/main zůstane jen repo.
  const repo = repoPart.replace(/\.git$/i, "");
  const namePattern = /^[A-Za-z0-9._-]+$/;
  if (!namePattern.test(owner) || !namePattern.test(repo)) return null;

  return `${owner}/${repo}`;
}

export function repoUrl(fullName: string): string {
  return `https://github.com/${fullName}`;
}

export type RepoCommit = {
  sha: string;
  message: string;
  author: string;
  date: Date | null;
  url: string;
};

export type RepoPull = {
  number: number;
  title: string;
  author: string;
  draft: boolean;
  updatedAt: Date | null;
  url: string;
};

export type RepoRun = {
  name: string;
  status: string;
  conclusion: string | null;
  branch: string | null;
  createdAt: Date | null;
  url: string;
};

export type RepoOverview = {
  commits: RepoCommit[];
  pulls: RepoPull[];
  run: RepoRun | null;
  /** Actions se nemusí dát přečíst, i když commity ano — právo je zvlášť. */
  runsUnavailable: boolean;
};

type Fetched<T> = { data: T } | { error: string };

function explainFailure(status: number, fullName: string): string {
  if (status === 401) {
    return "GitHub token je neplatný nebo mu vypršela platnost.";
  }
  if (status === 404) {
    return `Repozitář ${fullName} neexistuje, nebo k němu token nemá přístup.`;
  }
  if (status === 403 || status === 429) {
    return "GitHub dotaz odmítl — vyčerpaná kvóta nebo token bez potřebných oprávnění.";
  }
  return "GitHub odpověděl chybou. Podrobnost je v logu serveru.";
}

async function get<T>(path: string, fullName: string): Promise<Fetched<T>> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { error: "Chybí GITHUB_TOKEN." };

  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: CACHE_SECONDS },
    });

    if (!response.ok) {
      console.error(`[github] ${path} vrátilo ${response.status}`);
      return { error: explainFailure(response.status, fullName) };
    }

    return { data: (await response.json()) as T };
  } catch (error) {
    console.error(`[github] Spojení s ${path} selhalo:`, error);
    return { error: "Nepodařilo se spojit s GitHubem." };
  }
}

function toDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** První řádek commit message. Zbytek je popis, do přehledu se nehodí. */
export function commitSummary(message: string): string {
  return message.split("\n")[0]?.trim() ?? "";
}

type ApiCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  author?: { login?: string } | null;
};

type ApiPull = {
  number: number;
  title: string;
  html_url: string;
  draft?: boolean;
  updated_at?: string;
  user?: { login?: string } | null;
};

type ApiRuns = {
  workflow_runs?: {
    name?: string;
    display_title?: string;
    status?: string;
    conclusion?: string | null;
    head_branch?: string | null;
    created_at?: string;
    html_url: string;
  }[];
};

/**
 * Přehled repozitáře pro panel u zakázky. Commity a pull requesty se načítají
 * naráz; když selžou, vracíme chybu. Selhání Actions přehled nezruší, jen se
 * schová — na Actions je potřeba další právo, které token mít nemusí.
 */
export async function repoOverview(
  fullName: string,
): Promise<RepoOverview | { error: string }> {
  const [commits, pulls, runs] = await Promise.all([
    get<ApiCommit[]>(`/repos/${fullName}/commits?per_page=${PER_PAGE}`, fullName),
    get<ApiPull[]>(
      `/repos/${fullName}/pulls?state=open&per_page=${PER_PAGE}`,
      fullName,
    ),
    get<ApiRuns>(`/repos/${fullName}/actions/runs?per_page=1`, fullName),
  ]);

  if ("error" in commits) return { error: commits.error };
  if ("error" in pulls) return { error: pulls.error };

  const latestRun = "error" in runs ? null : (runs.data.workflow_runs?.[0] ?? null);

  return {
    commits: commits.data.map((commit) => ({
      sha: commit.sha.slice(0, 7),
      message: commitSummary(commit.commit.message),
      author: commit.author?.login ?? commit.commit.author?.name ?? "neznámý",
      date: toDate(commit.commit.author?.date),
      url: commit.html_url,
    })),
    pulls: pulls.data.map((pull) => ({
      number: pull.number,
      title: pull.title,
      author: pull.user?.login ?? "neznámý",
      draft: Boolean(pull.draft),
      updatedAt: toDate(pull.updated_at),
      url: pull.html_url,
    })),
    run: latestRun
      ? {
          name: latestRun.display_title ?? latestRun.name ?? "Běh",
          status: latestRun.status ?? "unknown",
          conclusion: latestRun.conclusion ?? null,
          branch: latestRun.head_branch ?? null,
          createdAt: toDate(latestRun.created_at),
          url: latestRun.html_url,
        }
      : null,
    runsUnavailable: "error" in runs,
  };
}

const RUN_LABELS: Record<string, string> = {
  success: "prošlo",
  failure: "selhalo",
  cancelled: "zrušeno",
  skipped: "přeskočeno",
  timed_out: "vypršel čas",
  action_required: "čeká na zásah",
  neutral: "bez výsledku",
  startup_failure: "nespustilo se",
};

/** Stav běhu Actions česky. Dokud běh neskončil, zajímá nás status, ne výsledek. */
export function runLabel(run: RepoRun): string {
  if (run.status !== "completed") {
    return run.status === "queued" ? "ve frontě" : "běží";
  }
  return RUN_LABELS[run.conclusion ?? ""] ?? (run.conclusion ?? "neznámý stav");
}

export function runTone(run: RepoRun): "ok" | "error" | "neutral" {
  if (run.status !== "completed") return "neutral";
  if (run.conclusion === "success") return "ok";
  if (run.conclusion === "failure" || run.conclusion === "startup_failure") {
    return "error";
  }
  return "neutral";
}

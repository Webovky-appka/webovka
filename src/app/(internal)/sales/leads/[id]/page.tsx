import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import {
  EVIDENCE_LABELS,
  isEvidenceKind,
  type EvidenceItem,
} from "@/lib/sales/evidence";

export const metadata = {
  title: "Lead — Mitsov Web",
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Objevený",
  QUALIFYING: "Kvalifikuje se",
  QUALIFIED: "Kvalifikovaný",
  RESEARCHING: "Doplňuje se research",
  READY_FOR_REVIEW: "Ke schválení",
  APPROVED: "Schválený",
  CONTACTED: "Osloven",
  REPLIED: "Odpověděl",
  MEETING: "Schůzka",
  PROPOSAL: "Nabídka",
  WON: "Vyhráno",
  LOST: "Prohráno",
  REJECTED: "Zamítnutý",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-red-50 text-red-800 ring-red-100",
  medium: "bg-amber-50 text-amber-800 ring-amber-100",
  low: "bg-slate-100 text-slate-700 ring-slate-200",
};

const SEVERITY_LABELS: Record<string, string> = {
  high: "vážné",
  medium: "střední",
  low: "drobné",
};

type Findings = {
  strengths?: string[];
  problems?: { title: string; explanation: string; severity: string }[];
  opportunities?: string[];
  recommendation?: string;
  evidence?: EvidenceItem[];
};

export default async function LeadPage(props: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await props.params;

  const lead = await prisma.salesLead.findUnique({
    where: { id },
    include: {
      prospect: { include: { contacts: true } },
      campaign: { select: { id: true, name: true } },
      audits: { orderBy: { createdAt: "desc" }, take: 1 },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!lead) notFound();

  const audit = lead.audits[0] ?? null;
  const findings = (audit?.findings ?? {}) as Findings;
  const evidence = (findings.evidence ?? []).filter((item) =>
    isEvidenceKind(item.kind),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/sales/${lead.campaign.id}`}
          className="text-sm text-slate-500 transition hover:text-slate-900"
        >
          ← {lead.campaign.name}
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {lead.prospect.name}
            </h1>
            <p className="text-sm text-slate-500">
              {[lead.prospect.industry, lead.prospect.location]
                .filter(Boolean)
                .join(" · ") || "Bez zařazení"}
              {lead.prospect.domain ? (
                <>
                  {" · "}
                  <a
                    href={`https://${lead.prospect.domain}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-700 underline hover:text-sky-900"
                  >
                    {lead.prospect.domain}
                  </a>
                </>
              ) : null}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-slate-900">
              {lead.score ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              {STATUS_LABELS[lead.status] ?? lead.status}
            </p>
          </div>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Proč tuhle firmu oslovit
        </h2>
        <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">
          {lead.reason ?? "Bez zdůvodnění."}
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Síla firmy</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {lead.businessScore ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Kvalita webu</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {lead.websiteScore ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Digital gap</dt>
            <dd className="text-lg font-semibold text-slate-900">
              {lead.opportunityGap !== null
                ? `${lead.opportunityGap > 0 ? "+" : ""}${lead.opportunityGap}`
                : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {audit ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Audit webu
            </h2>
            <p className="text-xs text-slate-500">
              {formatDateTime(audit.createdAt)}
              {audit.confidence !== null
                ? ` · confidence ${Math.round(audit.confidence * 100)} %`
                : ""}
            </p>
          </div>

          {audit.summary ? (
            <p className="text-sm text-slate-700">{audit.summary}</p>
          ) : null}

          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
            {[
              ["Vizuál", audit.visualScore],
              ["UX", audit.uxScore],
              ["Mobil", audit.mobileScore],
              ["Konverze", audit.conversionScore],
              ["SEO", audit.seoScore],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-semibold text-slate-900">
                  {value ?? "—"}
                  <span className="text-xs font-normal text-slate-400">/100</span>
                </dd>
              </div>
            ))}
          </dl>

          {findings.problems && findings.problems.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Problémy
              </h3>
              <ul className="space-y-2">
                {findings.problems.map((problem, index) => (
                  <li key={index} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                      {problem.title}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${SEVERITY_STYLES[problem.severity] ?? SEVERITY_STYLES.low}`}
                      >
                        {SEVERITY_LABELS[problem.severity] ?? problem.severity}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {problem.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {findings.strengths && findings.strengths.length > 0 ? (
            <div className="space-y-1">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Silné stránky
              </h3>
              <ul className="list-inside list-disc text-sm text-slate-700">
                {findings.strengths.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {findings.recommendation ? (
            <div className="rounded-lg bg-emerald-50 px-3 py-2">
              <h3 className="text-xs font-medium tracking-wide text-emerald-700 uppercase">
                Doporučení
              </h3>
              <p className="mt-1 text-sm text-emerald-900">
                {findings.recommendation}
              </p>
            </div>
          ) : null}

          {evidence.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Evidence — co je fakt a co úsudek
              </h3>
              <ul className="space-y-1.5">
                {evidence.map((item, index) => (
                  <li
                    key={index}
                    className="flex flex-wrap items-baseline gap-2 text-sm"
                  >
                    <span
                      title={EVIDENCE_LABELS[item.kind].hint}
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${
                        item.kind === "OBSERVED"
                          ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                          : item.kind === "DERIVED"
                            ? "bg-sky-50 text-sky-800 ring-sky-100"
                            : item.kind === "AI_JUDGMENT"
                              ? "bg-amber-50 text-amber-800 ring-amber-100"
                              : "bg-slate-100 text-slate-600 ring-slate-200"
                      }`}
                    >
                      {EVIDENCE_LABELS[item.kind].label}
                    </span>
                    <span className="text-slate-700">{item.claim}</span>
                    {item.source ? (
                      <span className="text-xs text-slate-400">
                        ({item.source})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          Audit zatím neproběhl. Provede se automaticky v běhu po kvalifikaci.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-medium text-slate-900">Timeline</h2>
        <ul className="space-y-1.5">
          {lead.activities.map((activity) => (
            <li
              key={activity.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <p className="text-slate-700">{activity.body}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {activity.actor} · {formatDateTime(activity.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

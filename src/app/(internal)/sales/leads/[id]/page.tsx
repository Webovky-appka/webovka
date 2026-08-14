import Link from "next/link";
import { notFound } from "next/navigation";

import { OutcomePanel } from "@/components/sales/outcome-panel";
import { ReauditButton } from "@/components/sales/reaudit-button";
import { OwnerNoteForm } from "@/components/sales/owner-note-form";
import { ReopenButton } from "@/components/sales/reopen-button";
import { RateWebsite } from "@/components/sales/rate-website";
import { RescanButton } from "@/components/sales/rescan-button";
import { ReviewPanel } from "@/components/sales/review-panel";
import { UndoWonButton } from "@/components/sales/undo-won-button";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { googleAccountFor } from "@/lib/google";
import { prisma } from "@/lib/prisma";
import { isSharedPlatformDomain } from "@/lib/sales/dedupe";
import { followUpNote, needsFollowUp } from "@/lib/sales/follow-up";
import { canRescan } from "@/lib/sales/funnel";
import { SCORE_FORMULA_HINT } from "@/lib/sales/score";
import {
  EVIDENCE_LABELS,
  isEvidenceKind,
  type EvidenceItem,
} from "@/lib/sales/evidence";
import {
  parseResearchHooks,
  RESEARCH_CATEGORY_LABELS,
} from "@/lib/sales/research-hooks";
import { isVisualBreakdown, VISUAL_DIMENSIONS } from "@/lib/sales/visual";

export const metadata = {
  title: "Příležitost — Mitsov Web",
};

const STATUS_LABELS: Record<string, string> = {
  DISCOVERED: "Objevený",
  QUALIFYING: "Kvalifikuje se",
  QUALIFIED: "Kvalifikovaný",
  RESEARCHING: "Doplňuje se research",
  READY_FOR_REVIEW: "Ke schválení",
  APPROVED: "Koncept připraven",
  SCHEDULED: "Naplánováno k odeslání",
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
  visual?: unknown;
};

export default async function LeadPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await props.params;

  const lead = await prisma.salesLead.findUnique({
    where: { id },
    include: {
      prospect: { include: { contacts: { orderBy: { isPrimary: "desc" } } } },
      campaign: { select: { id: true, name: true, minScore: true } },
      audits: { orderBy: { createdAt: "desc" }, take: 1 },
      emails: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { revisions: { orderBy: { createdAt: "desc" }, take: 10 } },
      },
      activities: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!lead) notFound();

  const draft = lead.emails[0] ?? null;
  const gmailAccount =
    draft?.status === "DRAFT" ? await googleAccountFor(user.id) : null;
  const primaryContact =
    lead.prospect.contacts.find((contact) => contact.isPrimary) ??
    lead.prospect.contacts.find((contact) => contact.email) ??
    null;

  const noOwnWebsite =
    !lead.prospect.domain || isSharedPlatformDomain(lead.prospect.domain);
  const canReaudit =
    lead.prospect.domain !== null &&
    !noOwnWebsite &&
    ["QUALIFIED", "RESEARCHING", "READY_FOR_REVIEW", "APPROVED"].includes(
      lead.status,
    );
  const rescanAllowed = canRescan(lead.status);
  // Poslední skutečně odeslaný e-mail — z něj se počítá připomínka druhého
  // oslovení. Rozpracované návrhy do toho nemluví.
  const sentDraft = lead.emails.find((email) => email.status === "SENT") ?? null;
  const followUpDue = needsFollowUp({
    status: lead.status,
    sentAt: sentDraft?.sentAt,
  });
  const audit = lead.audits[0] ?? null;
  const findings = (audit?.findings ?? {}) as Findings;
  const evidence = (findings.evidence ?? []).filter((item) =>
    isEvidenceKind(item.kind),
  );
  const visual = isVisualBreakdown(findings.visual) ? findings.visual : null;
  const researchHooks = parseResearchHooks(lead.research);
  const screenshotPages = (
    Array.isArray(lead.screenshotPages) ? lead.screenshotPages : []
  ).filter(
    (page): page is { label: string; key: string; url?: string } =>
      typeof page === "object" &&
      page !== null &&
      typeof (page as { key?: unknown }).key === "string",
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
            <p
              className={`text-2xl font-semibold ${
                lead.score === null
                  ? "text-slate-900"
                  : lead.score >= lead.campaign.minScore
                    ? "text-emerald-700"
                    : "text-red-600"
              }`}
            >
              {lead.score ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              Skóre příležitosti · vyšší = lepší
            </p>
            <p className="text-xs text-slate-400">
              práh kampaně {lead.campaign.minScore} ·{" "}
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
        <p className="mt-3 text-xs text-slate-500">
          {lead.businessScore !== null && lead.websiteScore !== null ? (
            <>
              Skóre {lead.score ?? "—"} = síla firmy {lead.businessScore} × (100
              − kvalita webu {lead.websiteScore}) / 100, přepočtené do obvyklého
              rozsahu.{" "}
            </>
          ) : null}
          {SCORE_FORMULA_HINT}
        </p>
      </section>

      {researchHooks.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Co jsme o firmě zjistili
            </h2>
            {lead.researchAt ? (
              <p className="text-xs text-slate-500">
                {formatDateTime(lead.researchAt)}
              </p>
            ) : null}
          </div>
          <ul className="mt-3 space-y-2">
            {researchHooks.map((hook, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200">
                  {RESEARCH_CATEGORY_LABELS[hook.category]}
                </span>
                <span className="text-slate-700">
                  {hook.claim}{" "}
                  <span
                    className="text-xs text-slate-400"
                    title={EVIDENCE_LABELS[hook.kind].hint}
                  >
                    {EVIDENCE_LABELS[hook.kind].label.toLowerCase()} ·{" "}
                    {hook.source}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {lead.status === "REJECTED" || lead.status === "LOST" ? (
        <section className="space-y-3 rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div>
            <h2 className="text-sm font-semibold text-red-900">
              {lead.status === "LOST"
                ? "Prohraná příležitost"
                : "Zamítnutá příležitost"}
            </h2>
            <p className="mt-0.5 text-sm text-red-800/80">
              {lead.lostReason ?? "Bez uvedeného důvodu."}
            </p>
          </div>
          <ReopenButton leadId={lead.id} />
          <OwnerNoteForm leadId={lead.id} note={lead.ownerNote} />
          {lead.status === "REJECTED" ? (
            <p className="text-xs text-red-800/70">
              Otevřením se rozjede kompletní proskenování a příležitost skončí
              ke schválení. Práh kampaně se u ní pak už neuplatní — rozhodl jste
              vy, ne skóre.
            </p>
          ) : null}
        </section>
      ) : null}

      {lead.screenshotDesktopKey || lead.screenshotMobileKey ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              Současný web
            </h2>
            {lead.screenshotAt ? (
              <p className="text-xs text-slate-500">
                {formatDateTime(lead.screenshotAt)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-start gap-4">
            {lead.screenshotDesktopKey ? (
              <a
                href={`/api/sales/screenshots/${lead.id}/desktop`}
                target="_blank"
                rel="noopener noreferrer"
                className="block min-w-0 flex-1 basis-72"
              >
                {/* Obrázky jdou přes autorizovanou API routu, next/image
                    optimalizátor by je stahoval bez session cookie. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/sales/screenshots/${lead.id}/desktop`}
                  alt={`Screenshot webu ${lead.prospect.name} na desktopu`}
                  className="w-full rounded-lg border border-slate-200"
                />
                <p className="mt-1 text-center text-xs text-slate-400">
                  Desktop 1440×900
                </p>
              </a>
            ) : null}
            {lead.screenshotMobileKey ? (
              <a
                href={`/api/sales/screenshots/${lead.id}/mobile`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-36 shrink-0 sm:w-44"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/sales/screenshots/${lead.id}/mobile`}
                  alt={`Screenshot webu ${lead.prospect.name} na mobilu`}
                  className="w-full rounded-lg border border-slate-200"
                />
                <p className="mt-1 text-center text-xs text-slate-400">
                  Mobil 390×844
                </p>
              </a>
            ) : null}
          </div>
          {screenshotPages.length > 0 ? (
            <div className="flex flex-wrap items-start gap-4">
              {screenshotPages.map((page, index) => (
                <div key={page.key} className="w-48 min-w-0">
                  <a
                    href={`/api/sales/screenshots/${lead.id}/page-${index}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/sales/screenshots/${lead.id}/page-${index}`}
                      alt={`Screenshot podstránky ${page.label}`}
                      className="w-full rounded-lg border border-slate-200"
                    />
                  </a>
                  {page.url ? (
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-center text-xs text-sky-700 underline-offset-2 hover:underline"
                      title={page.url}
                    >
                      {page.label || `Podstránka ${index + 1}`} ↗
                    </a>
                  ) : (
                    <p className="mt-1 truncate text-center text-xs text-slate-400">
                      {page.label || `Podstránka ${index + 1}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : null}
          <RateWebsite
            leadId={lead.id}
            humanScore={lead.humanWebScore}
            humanNote={lead.humanWebNote}
            active={lead.humanWebActive}
            modelScore={lead.websiteScore}
          />
        </section>
      ) : null}

      {lead.mockupKey ? (
        <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Koncept nové homepage
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Vygenerovaný návrh do přílohy e-mailu — před odesláním ho
                zkontrolujte, je to první nástřel.
              </p>
            </div>
            <a
              href={`/api/sales/screenshots/${lead.id}/mockup`}
              download={`koncept-${(lead.prospect.domain ?? lead.prospect.name).replace(/[^a-z0-9.-]+/gi, "-")}.jpg`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              Stáhnout přílohu
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/sales/screenshots/${lead.id}/mockup`}
            alt={`Koncept nové homepage pro ${lead.prospect.name}`}
            className="w-full rounded-lg border border-slate-200"
          />
        </section>
      ) : lead.mockupVariant === "none" ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-5 py-3 text-xs text-slate-500">
          Experiment Designera: tahle příležitost je v kontrolní skupině —
          e-mail jde záměrně bez konceptu homepage, ať jde změřit, jestli ukázka
          zvedá odpovědi.
        </p>
      ) : null}

      {draft && draft.status === "DRAFT" ? (
        <ReviewPanel
          draft={{
            id: draft.id,
            subject: draft.subject,
            body: draft.body,
            strategy: draft.strategy,
          }}
          revisions={draft.revisions.map((revision) => ({
            id: revision.id,
            instruction: revision.instruction,
            createdAt: revision.createdAt,
          }))}
          leadId={lead.id}
          leadStatus={lead.status}
          scheduledFor={lead.scheduledFor}
          defaultTo={primaryContact?.email ?? ""}
          gmailAddress={gmailAccount?.email ?? null}
        />
      ) : null}

      {followUpDue && sentDraft?.sentAt ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">
            Čas na druhé oslovení
          </h2>
          <p className="mt-1 text-sm text-amber-900/80">
            {followUpNote(sentDraft.sentAt)}
          </p>
          <p className="mt-2 text-xs text-amber-900/70">
            Odesláno {formatDate(sentDraft.sentAt)}. Návrh druhého e-mailu
            zatím nepíšeme — napište ho ručně, nebo příležitost proskenujte
            znovu a nechte agenty připravit nový text.
          </p>
        </section>
      ) : null}

      {["CONTACTED", "REPLIED", "MEETING", "PROPOSAL"].includes(lead.status) ? (
        <OutcomePanel leadId={lead.id} status={lead.status} />
      ) : null}

      {lead.status === "WON" ? (
        <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5">
          <p className="text-sm font-medium text-emerald-900">
            {lead.clientId
              ? "Vyhráno. Zakázka je založená — akvizice končí, dodávka začíná."
              : "Vyhráno. Založte klienta a zakázku — akvizice končí, dodávka začíná."}
          </p>
          <Link
            href={lead.clientId ? `/clients/${lead.clientId}` : "/clients/new"}
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            {lead.clientId
              ? "Otevřít zakázku"
              : `Založit klienta ${lead.prospect.name}`}
          </Link>
          <UndoWonButton leadId={lead.id} />
        </section>
      ) : null}

      {draft && draft.status !== "DRAFT" ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">
              {draft.status === "SENT" ? "Odeslaný e-mail" : "Zamítnutý návrh"}
            </h2>
            <p className="text-xs text-slate-500">
              {draft.sentAt ? formatDateTime(draft.sentAt) : ""}
            </p>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">
            {draft.subject}
          </p>
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-600">
            {draft.body}
          </p>
        </section>
      ) : null}

      {audit ? (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Audit webu
              </h2>
              <p className="text-xs text-slate-500">
                {formatDateTime(audit.createdAt)}
                {audit.confidence !== null
                  ? ` · jistota ${Math.round(audit.confidence * 100)} %`
                  : ""}
              </p>
            </div>
            <div className="space-y-3 text-right">
              {canReaudit ? <ReauditButton leadId={lead.id} /> : null}
              {rescanAllowed ? <RescanButton leadId={lead.id} /> : null}
            </div>
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
                  <span className="text-xs font-normal text-slate-400">
                    /100
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          {visual ? (
            <div className="space-y-2">
              <h3 className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Vizuál po dimenzích
              </h3>
              <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
                {VISUAL_DIMENSIONS.map((dimension) => {
                  const score = visual[dimension.key];
                  return (
                    <li
                      key={dimension.key}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="text-slate-600">{dimension.label}</span>
                      <span
                        className={`font-medium ${
                          score <= 3
                            ? "text-red-700"
                            : score <= 6
                              ? "text-amber-700"
                              : "text-emerald-700"
                        }`}
                      >
                        {score}/10
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

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
        <div className="space-y-3 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
          <p>
            {noOwnWebsite
              ? "Vlastní web firmy se nenašel — audit se přeskakuje a e-mail nabízí stavbu prvního webu. Když ho Contact Research dodatečně objeví, příležitost se do auditu vrátí sama."
              : "Audit webu zatím neproběhl, takže tady nejsou ani snímky, ani zjištění."}
          </p>
          {rescanAllowed ? (
            <div className="flex justify-center">
              <RescanButton
                leadId={lead.id}
                label="Proskenovat a připravit e-mail"
                prominent
                centered
              />
            </div>
          ) : canReaudit ? (
            <div className="flex justify-center">
              <ReauditButton leadId={lead.id} />
            </div>
          ) : null}
        </div>
      )}

      {lead.prospect.contacts.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Kontakty</h2>
          <ul className="space-y-1.5 text-sm">
            {lead.prospect.contacts.map((contact) => (
              <li
                key={contact.id}
                className="flex flex-wrap items-baseline gap-2"
              >
                <span className="text-slate-900">
                  {contact.name ?? "Obecný kontakt"}
                  {contact.role ? ` (${contact.role})` : ""}
                </span>
                {contact.email ? (
                  <span className="text-slate-700">{contact.email}</span>
                ) : null}
                {contact.phone ? (
                  <span className="text-slate-500">{contact.phone}</span>
                ) : null}
                <span className="text-xs text-slate-400">
                  {contact.source ?? "bez zdroje"} · jistota{" "}
                  {Math.round(contact.confidence * 100)} %
                  {contact.isPrimary ? " · primární" : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

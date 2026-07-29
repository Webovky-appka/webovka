import { disconnectGmail } from "@/app/actions/google";
import { formatDate } from "@/lib/format";

/**
 * Výsledek napojení chodí v adrese jako krátký kód, ne jako hotová věta —
 * cizí odkaz by jinak uživateli mohl podstrčit vymyšlenou zprávu.
 */
const RESULTS: Record<string, { text: string; tone: "ok" | "error" }> = {
  ok: { text: "Gmail je napojený.", tone: "ok" },
  zamitnuto: { text: "Napojení jste v Googlu zamítl.", tone: "error" },
  stav: {
    text: "Návrat z Googlu neodpovídal přihlášení. Zkuste napojení znovu.",
    tone: "error",
  },
  "bez-tokenu": {
    text: "Google nevrátil trvalý token. Odeberte aplikaci v nastavení účtu Google a napojte ji znovu.",
    tone: "error",
  },
  nenastaveno: {
    text: "Chybí GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET. Bez nich napojení nejde.",
    tone: "error",
  },
  chyba: {
    text: "Napojení se nepovedlo. Podrobnost je v logu serveru.",
    tone: "error",
  },
};

export function GmailPanel({
  account,
  configured,
  aiReady,
  aiModel,
  result,
}: {
  account: { email: string; createdAt: Date } | null;
  configured: boolean;
  aiReady: boolean;
  aiModel: string;
  result?: string;
}) {
  const message = result ? RESULTS[result] : undefined;

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          Odesílání e-mailů klientům
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Napojení na Gmail umožní posílat e-maily z vaší adresy přímo z
          aplikace. Aplikace dostane jen právo odesílat, na čtení pošty nemá
          oprávnění.
        </p>
      </div>

      {message ? (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            message.tone === "ok"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      ) : null}

      {account ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Napojeno na <strong>{account.email}</strong> od{" "}
            {formatDate(account.createdAt)}.
          </p>
          <form action={disconnectGmail}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Odpojit Gmail
            </button>
          </form>
        </div>
      ) : (
        <div className="space-y-2">
          {configured ? (
            <a
              href="/api/google/connect"
              className="inline-block rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Napojit Gmail
            </a>
          ) : (
            <p className="text-sm text-slate-500">
              Nejdřív je potřeba doplnit GOOGLE_CLIENT_ID a GOOGLE_CLIENT_SECRET.
              Postup je v DEPLOYMENT.md.
            </p>
          )}
          <p className="text-xs text-amber-700">
            Dokud je aplikace v Google Cloudu v režimu Testing, vyžaduje Google
            napojení znovu každých 7 dní.
          </p>
        </div>
      )}

      <hr className="border-slate-100" />

      <p className="text-xs text-slate-500">
        {aiReady
          ? `Návrhy e-mailů píše model ${aiModel}. Podklady o zakázce se posílají do OpenAI.`
          : "Návrhy e-mailů se skládají ze šablony. Pro psaní modelem doplňte OPENAI_API_KEY."}
      </p>
    </section>
  );
}

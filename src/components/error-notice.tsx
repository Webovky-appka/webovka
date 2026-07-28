export function ErrorNotice({
  title,
  description,
  digest,
  action,
}: {
  title: string;
  description: string;
  digest?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        {action ? (
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {action}
          </div>
        ) : null}

        {/* Kód slouží k dohledání chyby v logu serveru. Nic o ní neprozrazuje. */}
        {digest ? (
          <p className="mt-6 font-mono text-xs text-slate-400">
            Kód chyby: {digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export const errorButtonClasses =
  "rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800";

export const errorLinkClasses =
  "rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50";

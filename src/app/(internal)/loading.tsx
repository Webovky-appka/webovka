export default function InternalLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Načítám">
      <div className="h-7 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-14 animate-pulse rounded-xl bg-slate-100" />
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}

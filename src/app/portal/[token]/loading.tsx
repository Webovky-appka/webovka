export default function PortalLoading() {
  return (
    <main
      className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-8"
      aria-busy="true"
      aria-label="Načítám"
    >
      <div className="h-7 w-56 animate-pulse rounded bg-slate-200" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
    </main>
  );
}

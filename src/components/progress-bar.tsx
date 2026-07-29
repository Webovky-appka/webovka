export function ProgressBar({
  done,
  total,
  label,
  className = "",
}: {
  done: number;
  total: number;
  /** Vlastní popisek vedle pruhu. Bez něj se ukáže jen "hotové/celkem". */
  label?: string;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label ?? `Hotovo ${done} z ${total}`}
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="shrink-0 text-xs text-slate-500">
        {label ?? `${done}/${total}`}
      </span>
    </div>
  );
}

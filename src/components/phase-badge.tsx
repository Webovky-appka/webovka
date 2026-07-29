import { phaseBadgeClasses } from "@/lib/phases";

export function PhaseBadge({
  name,
  state = "active",
}: {
  name: string;
  state?: "done" | "active" | "future";
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${phaseBadgeClasses(state)}`}
    >
      {name}
    </span>
  );
}

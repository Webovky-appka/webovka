import type { Phase } from "@prisma/client";

import { PHASE_BADGE_CLASSES, PHASE_LABELS } from "@/lib/phases";

export function PhaseBadge({ phase }: { phase: Phase }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${PHASE_BADGE_CLASSES[phase]}`}
    >
      {PHASE_LABELS[phase]}
    </span>
  );
}

import "server-only";

import { DEFAULT_PROMPTS, type SalesAgent } from "@/lib/sales/agents";
import { prisma } from "@/lib/prisma";

export type ActivePrompt = {
  system: string;
  /** null = jede se na výchozím promptu z kódu, žádná verze v databázi. */
  versionId: string | null;
  version: number | null;
};

/**
 * Aktivní prompt agenta: uložená verze z databáze, jinak výchozí z kódu.
 * Výchozí se do databáze nezapisuje — verze vzniká až první úpravou,
 * aby registr nezanášel řádky, které nikdo nezměnil.
 */
export async function getActivePrompt(agent: SalesAgent): Promise<ActivePrompt> {
  const active = await prisma.salesPromptVersion.findFirst({
    where: { agent, active: true },
    select: { id: true, version: true, system: true },
  });

  if (!active) {
    return { system: DEFAULT_PROMPTS[agent], versionId: null, version: null };
  }

  return { system: active.system, versionId: active.id, version: active.version };
}

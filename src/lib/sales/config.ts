import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Globální přepínače AI Sales. Řádek nemusí existovat — chybějící nastavení
 * znamená výchozí stav (všechno zapnuté), takže se nikde nemusí zakládat
 * dopředu.
 */
export type SalesConfigValues = {
  designerEnabled: boolean;
};

const DEFAULTS: SalesConfigValues = { designerEnabled: true };

export async function salesConfig(): Promise<SalesConfigValues> {
  const row = await prisma.salesConfig.findUnique({
    where: { id: "sales" },
    select: { designerEnabled: true },
  });
  return row ?? DEFAULTS;
}

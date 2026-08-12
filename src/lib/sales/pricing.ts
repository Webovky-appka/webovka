/**
 * Ceník modelů pro cost tracking v AgentRun. Ceny jsou v USD za milion tokenů
 * podle ceníku OpenAI; neznámý model se počítá jako nula, ale tokeny se
 * zapisují vždy — cena se pak dá dopočítat zpětně.
 *
 * Čistý modul bez server-only, ať jde testovat.
 */

type ModelPrice = { inputPerMillion: number; outputPerMillion: number };

const MODEL_PRICES: Record<string, ModelPrice> = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  "gpt-4.1": { inputPerMillion: 2, outputPerMillion: 8 },
  "gpt-4.1-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-5": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "gpt-5-mini": { inputPerMillion: 0.25, outputPerMillion: 2 },
};

/**
 * Novější varianty (gpt-5.4, gpt-5.5, datované verze) v ceníku nemáme —
 * jejich sazby se tady nevymýšlejí. Účtují se podle rodiny gpt-5, což je
 * přiznaný odhad: lepší přibližná částka než tichá nula. Kdo bude chtít
 * přesně, doplní sazbu do MODEL_PRICES.
 */
function priceFor(model: string): ModelPrice | undefined {
  const exact = MODEL_PRICES[model];
  if (exact) return exact;

  if (/^gpt-5/.test(model)) {
    return /-(mini|nano)/.test(model)
      ? MODEL_PRICES["gpt-5-mini"]
      : MODEL_PRICES["gpt-5"];
  }
  if (/^gpt-4o/.test(model)) {
    return /-mini/.test(model)
      ? MODEL_PRICES["gpt-4o-mini"]
      : MODEL_PRICES["gpt-4o"];
  }
  if (/^gpt-4\.1/.test(model)) {
    return /-mini/.test(model)
      ? MODEL_PRICES["gpt-4.1-mini"]
      : MODEL_PRICES["gpt-4.1"];
  }
  return undefined;
}

/**
 * Paušál za jedno volání web search nástroje, v mikrodolarech. OpenAI účtuje
 * vyhledávání zvlášť od tokenů; je to odhad podle ceníku, ne přesná částka
 * z faktury — přesnost na haléře tady nikdo neslibuje.
 */
export const WEB_SEARCH_FEE_MICRO_USD = 25_000;

/** Cena běhu v mikrodolarech (1 USD = 1 000 000). Celá čísla, žádné floaty. */
export function costMicroUsd({
  model,
  tokensIn,
  tokensOut,
  webSearchCalls = 0,
}: {
  model: string;
  tokensIn: number;
  tokensOut: number;
  webSearchCalls?: number;
}): number {
  const price = priceFor(model);
  const tokenCost = price
    ? Math.round(
        tokensIn * price.inputPerMillion + tokensOut * price.outputPerMillion,
      )
    : 0;

  return tokenCost + webSearchCalls * WEB_SEARCH_FEE_MICRO_USD;
}

export function formatCost(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "")}`;
}

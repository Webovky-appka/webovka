import "server-only";

import type { Prisma } from "@prisma/client";
import type * as z from "zod";

import { prisma } from "@/lib/prisma";
import { costMicroUsd } from "@/lib/sales/pricing";

/**
 * Jediné místo, kudy agenti volají model (sekce 33 specifikace). Každé volání
 * se zapíše do AgentRun — s tokeny, cenou, verzí promptu a chybou, když
 * nastane. Bez záznamu se model nevolá.
 *
 * Používá se OpenAI Responses API, protože umí web search jako nástroj
 * a strukturovaný výstup podle JSON schématu v jednom požadavku.
 */
const RESPONSES_URL = "https://api.openai.com/v1/responses";
const TIMEOUT_MS = 120_000;

/** Mapa úloha → model. Přebíjí se proměnnými prostředí, ne zásahem do kódu. */
const MODEL_ROUTING: Record<string, { env: string; fallback: string }> = {
  "scout-discover": { env: "SALES_MODEL_DISCOVER", fallback: "gpt-4o" },
  "scout-qualify": { env: "SALES_MODEL_QUALIFY", fallback: "gpt-4o-mini" },
  audit: { env: "SALES_MODEL_AUDIT", fallback: "gpt-4o" },
  contact: { env: "SALES_MODEL_CONTACT", fallback: "gpt-4o" },
  // Text e-mailu a HTML konceptu čte člověk a rozhoduje podle nich o oslovení,
  // takže tady se na modelu nešetří — nejsilnější dostupný.
  outreach: { env: "SALES_MODEL_OUTREACH", fallback: "gpt-5.5" },
  designer: { env: "SALES_MODEL_DESIGNER", fallback: "gpt-5.5" },
  // Research bez záznamu padal na gpt-4o-mini a háčky byly mdlé.
  research: { env: "SALES_MODEL_RESEARCH", fallback: "gpt-4o" },
  // Dohledání IČO a sídla při zakládání zakázky — web search chce silný model.
  "client-details": { env: "SALES_MODEL_CONTACT", fallback: "gpt-4o" },
};

export function resolveModel(task: string): string {
  const route = MODEL_ROUTING[task];
  if (!route) return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return process.env[route.env] ?? route.fallback;
}

type ResponsesOutputItem = {
  type: string;
  content?: { type: string; text?: string }[];
};

export type AgentImage = { label: string; data: Buffer; mimeType: string };

type UserContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

/**
 * Obsah uživatelské zprávy. Bez obrázků prostý text (levnější serializace),
 * s obrázky pole částí — obrázky jdou do API jako data URL, do AgentRun se
 * ale ukládají jen jejich popisky, base64 by záznamy nafoukl na megabajty.
 */
export function buildUserContent(
  input: string,
  images: AgentImage[],
): string | UserContentPart[] {
  if (images.length === 0) return input;

  return [
    { type: "input_text", text: input },
    ...images.map(
      (image): UserContentPart => ({
        type: "input_image",
        image_url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
        detail: "auto",
      }),
    ),
  ];
}

type ResponsesPayload = {
  output?: ResponsesOutputItem[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
};

/** Poskládá text odpovědi z output pole. output_text je jen ve výstupu SDK. */
function extractText(payload: ResponsesPayload): string {
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const piece of item.content ?? []) {
      if (piece.type === "output_text" && piece.text) parts.push(piece.text);
    }
  }
  return parts.join("");
}

function countWebSearches(payload: ResponsesPayload): number {
  return (payload.output ?? []).filter((item) =>
    item.type.startsWith("web_search"),
  ).length;
}

export type AgentCallResult<T> =
  | { ok: true; data: T; agentRunId: string }
  | { ok: false; error: string; agentRunId: string };

/**
 * Zavolá model pro jednoho agenta a výsledek zvaliduje Zod schématem.
 * JSON schéma pro API se předává zvlášť — musí být strict (additionalProperties
 * false všude), což ze Zodu nejde spolehlivě vyrobit, tak se píše ručně.
 */
export async function callAgentModel<T>(options: {
  task: string;
  agent: string;
  system: string;
  input: string;
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  zodSchema: z.ZodType<T>;
  useWebSearch?: boolean;
  /** Obrázky k textovému vstupu — dělají z volání multimodální audit. */
  images?: AgentImage[];
  promptVersionId?: string | null;
  runId?: string | null;
  campaignId?: string | null;
  leadId?: string | null;
}): Promise<AgentCallResult<T>> {
  const model = resolveModel(options.task);
  const images = options.images ?? [];

  const agentRun = await prisma.agentRun.create({
    data: {
      agent: options.agent,
      model,
      promptVersionId: options.promptVersionId ?? null,
      runId: options.runId ?? null,
      campaignId: options.campaignId ?? null,
      leadId: options.leadId ?? null,
      // Vstup se ukládá celý — bez něj se nedá zpětně zjistit, proč agent
      // rozhodl, jak rozhodl (data lineage, sekce 34). Z obrázků jen popisky.
      input: {
        task: options.task,
        system: options.system,
        input: options.input,
        ...(images.length > 0
          ? { images: images.map((image) => image.label) }
          : {}),
      },
    },
    select: { id: true },
  });

  const fail = async (error: string): Promise<AgentCallResult<T>> => {
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: { status: "FAILED", error, finishedAt: new Date() },
    });
    return { ok: false, error, agentRunId: agentRun.id };
  };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fail("Není nastavený klíč OPENAI_API_KEY.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let payload: ResponsesPayload;
  try {
    const response = await fetch(RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: options.system },
          { role: "user", content: buildUserContent(options.input, images) },
        ],
        ...(options.useWebSearch ? { tools: [{ type: "web_search" }] } : {}),
        text: {
          format: {
            type: "json_schema",
            name: options.schemaName,
            schema: options.jsonSchema,
            strict: true,
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    payload = (await response.json()) as ResponsesPayload;

    if (!response.ok) {
      const detail = payload.error?.message ?? `HTTP ${response.status}`;
      return fail(`OpenAI odpověděla chybou: ${detail}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return fail("Model neodpověděl do dvou minut.");
    }
    return fail("Spojení s OpenAI selhalo.");
  } finally {
    clearTimeout(timer);
  }

  const tokensIn = payload.usage?.input_tokens ?? 0;
  const tokensOut = payload.usage?.output_tokens ?? 0;
  const webSearchCalls = countWebSearches(payload);
  const text = extractText(payload);

  let parsed: T;
  try {
    const candidate: unknown = JSON.parse(text);
    const result = options.zodSchema.safeParse(candidate);
    if (!result.success) {
      throw new Error(result.error.issues[0]?.message ?? "schéma nesedí");
    }
    parsed = result.data;
  } catch (error) {
    await prisma.agentRun.update({
      where: { id: agentRun.id },
      data: {
        status: "FAILED",
        error: `Výstup modelu neodpovídá schématu: ${error instanceof Error ? error.message : "neznámá chyba"}`,
        output: { raw: text.slice(0, 4000) },
        tokensIn,
        tokensOut,
        costMicroUsd: costMicroUsd({ model, tokensIn, tokensOut, webSearchCalls }),
        finishedAt: new Date(),
      },
    });
    return {
      ok: false,
      error: "Výstup modelu neodpovídá schématu.",
      agentRunId: agentRun.id,
    };
  }

  const summary =
    typeof (parsed as { summary?: unknown }).summary === "string"
      ? ((parsed as { summary: string }).summary satisfies string)
      : null;

  await prisma.agentRun.update({
    where: { id: agentRun.id },
    data: {
      status: "COMPLETED",
      output: parsed as unknown as Prisma.InputJsonValue,
      summary,
      tokensIn,
      tokensOut,
      costMicroUsd: costMicroUsd({ model, tokensIn, tokensOut, webSearchCalls }),
      finishedAt: new Date(),
    },
  });

  return { ok: true, data: parsed, agentRunId: agentRun.id };
}

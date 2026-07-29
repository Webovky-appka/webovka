import "server-only";

/**
 * Napojení na OpenAI. Voláme HTTP rozhraní přímo, aby aplikace nepřibírala další
 * závislost. Bez OPENAI_API_KEY se návrh e-mailu skládá ze šablony a nic se
 * nikam neposílá.
 */
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 30_000;

export type AiResult = { text: string } | { error: string };

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function aiModel(): string {
  return process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
}

export async function generateText({
  system,
  prompt,
  maxTokens = 900,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
}): Promise<AiResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { error: "Není nastavený klíč OPENAI_API_KEY." };

  // Bez limitu by se čekání na model protáhlo do timeoutu celé akce.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      // Teplotu neposíláme schválně — novější modely jinou než výchozí odmítají.
      body: JSON.stringify({
        model: aiModel(),
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      console.error(
        `[ai] OpenAI vrátila ${response.status}: ${detail?.error?.message ?? "bez popisu"}`,
      );

      if (response.status === 401) {
        return { error: "OpenAI klíč odmítla jako neplatný." };
      }
      if (response.status === 429) {
        return {
          error:
            "OpenAI hlásí vyčerpaný limit nebo kredit. Zkuste to za chvíli.",
        };
      }
      return { error: `OpenAI odpověděla chybou ${response.status}.` };
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = data.choices?.[0]?.message?.content;

    if (typeof text !== "string" || text.trim() === "") {
      return { error: "Model nevrátil žádný text." };
    }

    return { text: text.trim() };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { error: "Model neodpověděl do 30 sekund." };
    }
    console.error("[ai] Spojení s OpenAI selhalo:", error);
    return { error: "Nepodařilo se spojit s OpenAI." };
  } finally {
    clearTimeout(timer);
  }
}

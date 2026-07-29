import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { aiModel, generateText, isAiConfigured } from "./ai";

const KEY = "sk-test-tajny-klic-nesmi-uniknout";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function reply(content: string): Response {
  return jsonResponse({ choices: [{ message: { content } }] });
}

beforeEach(() => {
  process.env.OPENAI_API_KEY = KEY;
  delete process.env.OPENAI_MODEL;
  // Chyby z modelu logujeme, v testech je jen nechceme vidět.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
});

describe("nastavení modelu", () => {
  it("bez klíče se model nepoužívá", () => {
    delete process.env.OPENAI_API_KEY;
    expect(isAiConfigured()).toBe(false);
  });

  it("výchozí model jde přebít proměnnou", () => {
    expect(aiModel()).toBe("gpt-4o-mini");
    process.env.OPENAI_MODEL = "gpt-5-mini";
    expect(aiModel()).toBe("gpt-5-mini");
  });
});

describe("volání modelu", () => {
  it("bez klíče se nikam nevolá", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateText({ system: "s", prompt: "p" });

    expect(result).toEqual({ error: "Není nastavený klíč OPENAI_API_KEY." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("vrátí text odpovědi bez okolních mezer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("\n  Dobrý den,  \n")));

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      text: "Dobrý den,",
    });
  });

  it("pošle vybraný model, limit tokenů a klíč v hlavičce", async () => {
    process.env.OPENAI_MODEL = "gpt-5-mini";
    const fetchMock = vi.fn().mockResolvedValue(reply("text"));
    vi.stubGlobal("fetch", fetchMock);

    await generateText({ system: "systém", prompt: "zadání", maxTokens: 123 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));

    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.model).toBe("gpt-5-mini");
    expect(body.max_completion_tokens).toBe(123);
    expect(body.messages).toEqual([
      { role: "system", content: "systém" },
      { role: "user", content: "zadání" },
    ]);
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe(`Bearer ${KEY}`);
  });

  it("neposílá teplotu, kterou novější modely odmítají", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply("text"));
    vi.stubGlobal("fetch", fetchMock);

    await generateText({ system: "s", prompt: "p" });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));

    expect(body).not.toHaveProperty("temperature");
  });

  it("prázdnou odpověď bere jako chybu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("   ")));

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "Model nevrátil žádný text.",
    });
  });

  it("odpověď bez očekávané struktury bere jako chybu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "Model nevrátil žádný text.",
    });
  });

  it("u neplatného klíče to řekne narovinu", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { message: "Incorrect API key" } }, 401),
      ),
    );

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "OpenAI klíč odmítla jako neplatný.",
    });
  });

  it("u vyčerpaného limitu poradí zkusit to později", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 429)),
    );

    const result = await generateText({ system: "s", prompt: "p" });

    expect("error" in result && result.error).toMatch(/limit|kredit/);
  });

  it("jinou chybu vrátí s kódem", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ error: {} }, 503)),
    );

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "OpenAI odpověděla chybou 503.",
    });
  });

  it("přerušené spojení nepadá, jen se ohlásí", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket hang up")),
    );

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "Nepodařilo se spojit s OpenAI.",
    });
  });

  it("čekání na model má strop", async () => {
    const abort = new Error("The operation was aborted.");
    abort.name = "AbortError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(abort));

    expect(await generateText({ system: "s", prompt: "p" })).toEqual({
      error: "Model neodpověděl do 30 sekund.",
    });
  });

  it("klíč se nikdy nedostane do chybové zprávy", async () => {
    // Chyba se ukazuje uživateli i v logu, klíč v ní nesmí být za žádnou cenu.
    const cases = [
      jsonResponse({ error: { message: `bad key ${KEY}` } }, 401),
      jsonResponse({ error: { message: KEY } }, 500),
    ];

    for (const response of cases) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
      const result = await generateText({ system: "s", prompt: "p" });

      expect("error" in result && result.error).not.toContain(KEY);
    }
  });
});

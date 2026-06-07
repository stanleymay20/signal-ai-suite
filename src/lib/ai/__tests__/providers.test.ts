import { describe, expect, it } from "vitest";
import { resolveAIProvider } from "../providers";
import { OllamaProvider } from "../providers/ollama";
import { OpenAICompatibleProvider } from "../providers/openaiCompatible";

describe("provider abstraction", () => {
  it("explicit AI_PROVIDER=ollama selects Ollama", () => {
    const p = resolveAIProvider({ AI_PROVIDER: "ollama" });
    expect(p).toBeInstanceOf(OllamaProvider);
    expect(p.name).toBe("ollama");
  });

  it("explicit AI_PROVIDER=openai-compatible selects OpenAI-compatible", () => {
    const p = resolveAIProvider({
      AI_PROVIDER: "openai-compatible",
      OPENAI_BASE_URL: "https://api.example.com/v1",
      OPENAI_API_KEY: "sk",
    });
    expect(p).toBeInstanceOf(OpenAICompatibleProvider);
    expect(p.name).toBe("openai-compatible");
  });

  it("defaults to Ollama when OLLAMA_BASE_URL is set", () => {
    const p = resolveAIProvider({ OLLAMA_BASE_URL: "http://localhost:11434" });
    expect(p).toBeInstanceOf(OllamaProvider);
  });

  it("falls back to Lovable AI Gateway via OpenAI-compatible when LOVABLE_API_KEY present", () => {
    const p = resolveAIProvider({ LOVABLE_API_KEY: "lk_test" });
    expect(p).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("OllamaProvider posts to /api/chat and parses response", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
      return new Response(
        JSON.stringify({
          message: { role: "assistant", content: "hello" },
          prompt_eval_count: 10,
          eval_count: 5,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const p = new OllamaProvider({
      baseUrl: "http://x:11434",
      model: "llama3.1",
      fetchImpl: fakeFetch,
    });
    const out = await p.chat([{ role: "user", content: "hi" }]);
    expect(out.content).toBe("hello");
    expect(out.usage.totalTokens).toBe(15);
    expect(calls[0].url).toBe("http://x:11434/api/chat");
  });

  it("OpenAICompatibleProvider posts to /chat/completions with auth + headers", async () => {
    const seen: { url: string; headers: Headers; body: unknown }[] = [];
    const fakeFetch: typeof fetch = async (url, init) => {
      seen.push({
        url: String(url),
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body ?? "{}")),
      });
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "world" } }],
          usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    const p = new OpenAICompatibleProvider({
      baseUrl: "https://api.example.com/v1",
      model: "gpt-test",
      apiKey: "sk_test",
      headers: { "X-Custom": "1" },
      fetchImpl: fakeFetch,
    });
    const out = await p.chat([{ role: "user", content: "hi" }]);
    expect(out.content).toBe("world");
    expect(out.usage.totalTokens).toBe(5);
    expect(seen[0].url).toBe("https://api.example.com/v1/chat/completions");
    expect(seen[0].headers.get("Authorization")).toBe("Bearer sk_test");
    expect(seen[0].headers.get("X-Custom")).toBe("1");
  });

  it("OllamaProvider surfaces HTTP errors", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("boom", { status: 500 });
    const p = new OllamaProvider({
      baseUrl: "http://x:11434",
      model: "m",
      fetchImpl: fakeFetch,
    });
    await expect(p.chat([{ role: "user", content: "hi" }])).rejects.toThrow(/Ollama error 500/);
  });
});

import type { AIProvider, ChatMessage, ChatOptions, ChatResult } from "./types";

interface OllamaConfig {
  baseUrl: string;
  model: string;
  fetchImpl?: typeof fetch;
}

interface OllamaResponse {
  message?: { role: string; content: string };
  prompt_eval_count?: number;
  eval_count?: number;
}

/** Native Ollama /api/chat provider. Default chat backend per Phase 6 spec. */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(cfg: OllamaConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/+$/, "");
    this.model = cfg.model;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> {
    const res = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: {
          temperature: opts.temperature ?? 0.2,
          num_predict: opts.maxTokens ?? 1024,
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as OllamaResponse;
    const content = body.message?.content?.trim() ?? "";
    const promptTokens = body.prompt_eval_count;
    const completionTokens = body.eval_count;
    return {
      content,
      model: this.model,
      provider: this.name,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens:
          promptTokens !== undefined && completionTokens !== undefined
            ? promptTokens + completionTokens
            : undefined,
      },
    };
  }
}

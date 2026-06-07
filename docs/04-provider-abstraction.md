# 04 — Provider Abstraction

The AI layer is wrapped behind a tiny interface so the rest of the codebase
never depends on a specific vendor.

## Interface

```ts
// src/lib/ai/providers/types.ts
export interface AIProvider {
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], opts?: ChatOptions): Promise<ChatResult>;
}
```

`ChatMessage`, `ChatOptions`, and `ChatResult` are minimal, vendor-neutral
shapes. No tool-calling, function-calling, or streaming primitives leak
through — Phase 6 deliberately ships a synchronous chat surface.

## Implementations

| Class | Endpoint shape | Notes |
| --- | --- | --- |
| `OllamaProvider` | `POST {baseUrl}/api/chat` | Default. `stream: false`. Reports tokens via `prompt_eval_count` / `eval_count`. |
| `OpenAICompatibleProvider` | `POST {baseUrl}/chat/completions` | Works with OpenAI, Lovable AI Gateway, vLLM, LM Studio, Together, vast.ai vLLM, etc. Sends `Authorization: Bearer` when `apiKey` is set; honours extra headers (e.g. `Lovable-API-Key`). |

Both providers accept an injectable `fetchImpl`, which is what enables the
provider unit tests to assert exact request shape without mocking the
global `fetch`.

## Env-driven selection

```ts
resolveAIProvider(env)
```

Precedence:

1. `AI_PROVIDER=ollama` → Ollama.
2. `AI_PROVIDER=openai-compatible` (or `openai`) → OpenAI-compatible.
3. `OLLAMA_BASE_URL` set → Ollama.
4. `LOVABLE_API_KEY` or `OPENAI_BASE_URL` set → OpenAI-compatible (Lovable
   AI Gateway by default).
5. Fallback → Ollama at `http://localhost:11434`.

This is intentionally inert: changing provider is a deploy-time decision,
not a code change. Future targets (vast.ai + vLLM, Qwen, DeepSeek, Llama,
self-hosted gateways) plug in by setting `OPENAI_BASE_URL` and
`OPENAI_MODEL` — no business logic moves.

## Why a thin interface

The AI is a *presentation layer over evidence*. It receives a fully built
Evidence Package and a deterministic citation list and is asked to phrase
them. Anything richer (tool calls, retrieval-in-the-model, agentic loops)
would invite the model to bypass the pipeline — which is the failure mode
this product is designed to prevent.

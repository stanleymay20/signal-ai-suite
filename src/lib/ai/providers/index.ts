import { OllamaProvider } from "./ollama";
import { OpenAICompatibleProvider } from "./openaiCompatible";
import type { AIProvider } from "./types";

export type { AIProvider, ChatMessage, ChatResult, ChatUsage } from "./types";
export { OllamaProvider, OpenAICompatibleProvider };

export interface ProviderEnv {
  AI_PROVIDER?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_MODEL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  LOVABLE_API_KEY?: string;
}

/** Resolve an AIProvider from environment variables.
 *
 * Selection precedence:
 *   1. AI_PROVIDER=ollama                  → OllamaProvider
 *   2. AI_PROVIDER=openai-compatible       → OpenAICompatibleProvider
 *   3. Default → ollama if OLLAMA_BASE_URL set, else OpenAI-compatible via
 *      Lovable AI Gateway if LOVABLE_API_KEY is available.
 *
 * No provider is hardcoded; everything is environment-driven. */
export function resolveAIProvider(env: ProviderEnv): AIProvider {
  const explicit = (env.AI_PROVIDER ?? "").toLowerCase().trim();

  if (explicit === "ollama") return buildOllama(env);
  if (explicit === "openai-compatible" || explicit === "openai") {
    return buildOpenAICompatible(env);
  }

  if (env.OLLAMA_BASE_URL) return buildOllama(env);
  if (env.LOVABLE_API_KEY || env.OPENAI_BASE_URL) return buildOpenAICompatible(env);

  // Final fallback — Ollama default per Phase 6 spec.
  return buildOllama(env);
}

function buildOllama(env: ProviderEnv): OllamaProvider {
  return new OllamaProvider({
    baseUrl: env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    model: env.OLLAMA_MODEL ?? "llama3.1",
  });
}

function buildOpenAICompatible(env: ProviderEnv): OpenAICompatibleProvider {
  // Prefer explicit OpenAI-compatible config; fall back to Lovable AI Gateway
  // (which is OpenAI-compatible) when LOVABLE_API_KEY is present.
  if (env.OPENAI_BASE_URL) {
    return new OpenAICompatibleProvider({
      baseUrl: env.OPENAI_BASE_URL,
      model: env.OPENAI_MODEL ?? "gpt-4o-mini",
      apiKey: env.OPENAI_API_KEY,
    });
  }
  return new OpenAICompatibleProvider({
    baseUrl: "https://ai.gateway.lovable.dev/v1",
    model: env.OPENAI_MODEL ?? "google/gemini-3-flash-preview",
    headers: {
      "Lovable-API-Key": env.LOVABLE_API_KEY ?? "",
      "X-Lovable-AIG-SDK": "signal-ai-suite",
    },
  });
}

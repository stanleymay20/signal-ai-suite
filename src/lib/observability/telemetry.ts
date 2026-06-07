/** Telemetry helper for Phase 8 observability.
 *
 * Records structured `usage_events` rows for important user-facing actions.
 * Best-effort: telemetry insert failures NEVER throw — observability must
 * not break the underlying feature. */

export type UsageStatus = "success" | "error";

export interface UsageEventBase {
  action: string;
  actorId: string;
  workspaceId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  provider?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UsageEventOutcome {
  status: UsageStatus;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  costUsd?: number;
  errorMessage?: string | null;
  provider?: string | null;
  model?: string | null;
  metadata?: Record<string, unknown>;
}

export interface MinimalUsageClient {
  from: (table: "usage_events") => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
}

function clampToken(n: number | undefined): number {
  if (!Number.isFinite(n ?? NaN) || (n as number) < 0) return 0;
  return Math.floor(n as number);
}

export async function recordUsageEvent(
  supabase: MinimalUsageClient,
  base: UsageEventBase,
  outcome: UsageEventOutcome,
): Promise<void> {
  try {
    const row = {
      actor_id: base.actorId,
      workspace_id: base.workspaceId ?? null,
      action: base.action,
      resource_type: base.resourceType ?? null,
      resource_id: base.resourceId ?? null,
      status: outcome.status,
      duration_ms: Math.max(0, Math.floor(outcome.durationMs)),
      provider: outcome.provider ?? base.provider ?? null,
      model: outcome.model ?? base.model ?? null,
      prompt_tokens: clampToken(outcome.promptTokens),
      completion_tokens: clampToken(outcome.completionTokens),
      total_tokens: clampToken(
        outcome.totalTokens ?? (outcome.promptTokens ?? 0) + (outcome.completionTokens ?? 0),
      ),
      cost_usd: Number.isFinite(outcome.costUsd ?? NaN)
        ? Math.max(0, outcome.costUsd as number)
        : 0,
      error_message: outcome.errorMessage ?? null,
      metadata: { ...(base.metadata ?? {}), ...(outcome.metadata ?? {}) },
    };
    await supabase.from("usage_events").insert(row);
  } catch {
    // Swallow telemetry errors — observability is best-effort.
  }
}

export interface TelemetryHandle {
  success: (outcome?: Partial<UsageEventOutcome>) => Promise<void>;
  error: (err: unknown, extra?: Partial<UsageEventOutcome>) => Promise<void>;
  elapsedMs: () => number;
}

export function startTelemetry(
  supabase: MinimalUsageClient,
  base: UsageEventBase,
  now: () => number = Date.now,
): TelemetryHandle {
  const startedAt = now();
  let settled = false;
  return {
    elapsedMs: () => now() - startedAt,
    async success(outcome) {
      if (settled) return;
      settled = true;
      await recordUsageEvent(supabase, base, {
        status: "success",
        durationMs: now() - startedAt,
        ...(outcome ?? {}),
      });
    },
    async error(err, extra) {
      if (settled) return;
      settled = true;
      const msg = err instanceof Error ? err.message : String(err ?? "unknown error");
      await recordUsageEvent(supabase, base, {
        status: "error",
        durationMs: now() - startedAt,
        errorMessage: msg.slice(0, 1000),
        ...(extra ?? {}),
      });
    },
  };
}

/** Wraps an async function so its outcome is recorded as a usage event. */
export async function withTelemetry<T>(
  supabase: MinimalUsageClient,
  base: UsageEventBase,
  fn: () => Promise<T>,
  options: { now?: () => number; extract?: (result: T) => Partial<UsageEventOutcome> } = {},
): Promise<T> {
  const handle = startTelemetry(supabase, base, options.now);
  try {
    const result = await fn();
    await handle.success(options.extract ? options.extract(result) : undefined);
    return result;
  } catch (e) {
    await handle.error(e);
    throw e;
  }
}

/** Very rough cost estimation in USD for common providers. Returns 0 when
 *  the model is unknown — we never inflate cost beyond what we can ground. */
const COST_TABLE: Record<string, { input: number; output: number }> = {
  // $ per 1K tokens
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4.1-mini": { input: 0.0004, output: 0.0016 },
  "google/gemini-2.5-flash": { input: 0.000075, output: 0.0003 },
  "google/gemini-2.5-pro": { input: 0.00125, output: 0.005 },
  llama3: { input: 0, output: 0 },
  "llama3.1": { input: 0, output: 0 },
};

export function estimateCostUsd(
  model: string | null | undefined,
  promptTokens: number | undefined,
  completionTokens: number | undefined,
): number {
  if (!model) return 0;
  const rate = COST_TABLE[model];
  if (!rate) return 0;
  const p = clampToken(promptTokens);
  const c = clampToken(completionTokens);
  return (p / 1000) * rate.input + (c / 1000) * rate.output;
}

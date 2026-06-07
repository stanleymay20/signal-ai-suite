/** Database-backed rate limiter.
 *
 * Wraps the `public.check_rate_limit(user_id, action, max, window_seconds)`
 * Postgres function so server functions can throttle expensive operations
 * (chat replies, report generation, forecasting, anomaly detection) with one
 * atomic call.
 *
 * Limits are intentionally generous — they protect against abuse and runaway
 * loops, not normal interactive usage.
 */

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  window_start: string;
  reset_at: string;
}

export interface RateLimitConfig {
  /** Stable action label, e.g. "chat.message" or "report.generate". */
  action: string;
  /** Max calls within the window. */
  max: number;
  /** Window size in seconds. */
  windowSeconds: number;
}

/** Default per-user limits across the platform. */
export const RATE_LIMITS = {
  chat: { action: "chat.message", max: 30, windowSeconds: 60 },
  report: { action: "report.generate", max: 10, windowSeconds: 300 },
  forecast: { action: "forecast.run", max: 10, windowSeconds: 300 },
  anomaly: { action: "anomaly.run", max: 10, windowSeconds: 300 },
  export: { action: "report.export", max: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitConfig>;

export class RateLimitError extends Error {
  readonly status = 429;
  readonly result: RateLimitResult;
  constructor(action: string, result: RateLimitResult) {
    super(
      `Rate limit exceeded for ${action}. Limit ${result.limit} per window; ` +
        `try again at ${new Date(result.reset_at).toLocaleTimeString()}.`,
    );
    this.name = "RateLimitError";
    this.result = result;
  }
}

interface MinimalRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

/** Throws RateLimitError when exceeded. Best-effort: if the DB call itself
 * fails, the request is allowed through so telemetry/queue issues never
 * block legitimate user work — but the failure is logged. */
export async function enforceRateLimit(
  supabase: unknown,
  userId: string,
  config: RateLimitConfig,
): Promise<RateLimitResult | null> {
  try {
    const client = supabase as MinimalRpcClient;
    const { data, error } = await client.rpc("check_rate_limit", {
      _user_id: userId,
      _action: config.action,
      _max: config.max,
      _window_seconds: config.windowSeconds,
    });
    if (error) {
      console.warn(`[rate-limit] DB error (${config.action}):`, error.message);
      return null;
    }
    const result = data as RateLimitResult;
    if (!result?.allowed) {
      throw new RateLimitError(config.action, result);
    }
    return result;
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    console.warn("[rate-limit] unexpected error:", err);
    return null;
  }
}

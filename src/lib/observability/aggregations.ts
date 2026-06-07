/** Pure aggregation helpers for the admin observability dashboard. */

export interface UsageEventRow {
  id: string;
  action: string;
  status: "success" | "error";
  duration_ms: number;
  provider: string | null;
  model: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  created_at: string;
  actor_id: string | null;
  workspace_id: string | null;
  error_message: string | null;
}

export interface OverviewMetrics {
  totalEvents: number;
  successCount: number;
  errorCount: number;
  errorRate: number; // 0..1
  totalTokens: number;
  totalCostUsd: number;
  p50DurationMs: number;
  p95DurationMs: number;
  avgDurationMs: number;
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function computeOverview(events: UsageEventRow[]): OverviewMetrics {
  const total = events.length;
  if (total === 0) {
    return {
      totalEvents: 0,
      successCount: 0,
      errorCount: 0,
      errorRate: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      p50DurationMs: 0,
      p95DurationMs: 0,
      avgDurationMs: 0,
    };
  }
  const successCount = events.filter((e) => e.status === "success").length;
  const errorCount = total - successCount;
  const durations = events.map((e) => e.duration_ms);
  const totalTokens = events.reduce((a, e) => a + (e.total_tokens || 0), 0);
  const totalCost = events.reduce((a, e) => a + (Number(e.cost_usd) || 0), 0);
  const avg = durations.reduce((a, b) => a + b, 0) / total;
  return {
    totalEvents: total,
    successCount,
    errorCount,
    errorRate: errorCount / total,
    totalTokens,
    totalCostUsd: totalCost,
    p50DurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    avgDurationMs: Math.round(avg),
  };
}

export interface ActionStat {
  action: string;
  count: number;
  errorCount: number;
  errorRate: number;
  p50DurationMs: number;
  p95DurationMs: number;
  totalTokens: number;
  totalCostUsd: number;
}

export function groupByAction(events: UsageEventRow[]): ActionStat[] {
  const map = new Map<string, UsageEventRow[]>();
  for (const e of events) {
    const arr = map.get(e.action) ?? [];
    arr.push(e);
    map.set(e.action, arr);
  }
  const out: ActionStat[] = [];
  for (const [action, arr] of map) {
    const errorCount = arr.filter((e) => e.status === "error").length;
    const dur = arr.map((e) => e.duration_ms);
    out.push({
      action,
      count: arr.length,
      errorCount,
      errorRate: errorCount / arr.length,
      p50DurationMs: percentile(dur, 50),
      p95DurationMs: percentile(dur, 95),
      totalTokens: arr.reduce((a, e) => a + (e.total_tokens || 0), 0),
      totalCostUsd: arr.reduce((a, e) => a + (Number(e.cost_usd) || 0), 0),
    });
  }
  return out.sort((a, b) => b.count - a.count);
}

export interface ProviderModelStat {
  provider: string;
  model: string;
  count: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCostUsd: number;
}

export function groupByProviderModel(events: UsageEventRow[]): ProviderModelStat[] {
  const aiOnly = events.filter((e) => e.provider && e.model && e.total_tokens > 0);
  const map = new Map<string, ProviderModelStat>();
  for (const e of aiOnly) {
    const key = `${e.provider}::${e.model}`;
    const cur =
      map.get(key) ?? {
        provider: e.provider as string,
        model: e.model as string,
        count: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalCostUsd: 0,
      };
    cur.count += 1;
    cur.totalTokens += e.total_tokens || 0;
    cur.promptTokens += e.prompt_tokens || 0;
    cur.completionTokens += e.completion_tokens || 0;
    cur.totalCostUsd += Number(e.cost_usd) || 0;
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

export interface TopUserStat {
  actorId: string;
  count: number;
  totalCostUsd: number;
}

export function topUsers(events: UsageEventRow[], limit = 10): TopUserStat[] {
  const map = new Map<string, TopUserStat>();
  for (const e of events) {
    if (!e.actor_id) continue;
    const cur = map.get(e.actor_id) ?? { actorId: e.actor_id, count: 0, totalCostUsd: 0 };
    cur.count += 1;
    cur.totalCostUsd += Number(e.cost_usd) || 0;
    map.set(e.actor_id, cur);
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

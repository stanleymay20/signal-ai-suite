import { describe, it, expect } from "vitest";
import {
  percentile,
  computeOverview,
  groupByAction,
  groupByProviderModel,
  topUsers,
  type UsageEventRow,
} from "../aggregations";

function ev(partial: Partial<UsageEventRow>): UsageEventRow {
  return {
    id: "x",
    action: "chat.message",
    status: "success",
    duration_ms: 0,
    provider: null,
    model: null,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    created_at: new Date().toISOString(),
    actor_id: null,
    workspace_id: null,
    error_message: null,
    ...partial,
  };
}

describe("percentile", () => {
  it("returns 0 for empty arrays", () => {
    expect(percentile([], 50)).toBe(0);
  });
  it("returns the median (p50)", () => {
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
  });
  it("returns p95 near the top", () => {
    const vals = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(vals, 95)).toBe(95);
  });
});

describe("computeOverview", () => {
  it("returns all zeros on empty input", () => {
    const o = computeOverview([]);
    expect(o.totalEvents).toBe(0);
    expect(o.errorRate).toBe(0);
  });

  it("counts success/error and totals", () => {
    const events = [
      ev({ status: "success", duration_ms: 100, total_tokens: 50, cost_usd: 0.01 }),
      ev({ status: "error", duration_ms: 200, total_tokens: 0, cost_usd: 0 }),
      ev({ status: "success", duration_ms: 300, total_tokens: 70, cost_usd: 0.02 }),
    ];
    const o = computeOverview(events);
    expect(o.totalEvents).toBe(3);
    expect(o.successCount).toBe(2);
    expect(o.errorCount).toBe(1);
    expect(o.errorRate).toBeCloseTo(1 / 3);
    expect(o.totalTokens).toBe(120);
    expect(o.totalCostUsd).toBeCloseTo(0.03);
    expect(o.p50DurationMs).toBe(200);
  });
});

describe("groupByAction", () => {
  it("groups counts and computes per-action error rate", () => {
    const events = [
      ev({ action: "chat", status: "success", duration_ms: 100 }),
      ev({ action: "chat", status: "error", duration_ms: 200 }),
      ev({ action: "forecast.run", status: "success", duration_ms: 500 }),
    ];
    const stats = groupByAction(events);
    expect(stats[0].action).toBe("chat");
    expect(stats[0].count).toBe(2);
    expect(stats[0].errorRate).toBeCloseTo(0.5);
    const forecast = stats.find((s) => s.action === "forecast.run")!;
    expect(forecast.count).toBe(1);
  });
});

describe("groupByProviderModel", () => {
  it("ignores rows without provider/model/tokens and sums totals", () => {
    const events = [
      ev({
        provider: "openai",
        model: "gpt-4o-mini",
        total_tokens: 100,
        prompt_tokens: 60,
        completion_tokens: 40,
        cost_usd: 0.001,
      }),
      ev({
        provider: "openai",
        model: "gpt-4o-mini",
        total_tokens: 200,
        prompt_tokens: 100,
        completion_tokens: 100,
        cost_usd: 0.002,
      }),
      ev({ provider: "ollama", model: "llama3", total_tokens: 50, cost_usd: 0 }),
      ev({ provider: null, model: null, total_tokens: 0, cost_usd: 0 }),
    ];
    const stats = groupByProviderModel(events);
    expect(stats).toHaveLength(2);
    const top = stats[0];
    expect(top.provider).toBe("openai");
    expect(top.totalTokens).toBe(300);
    expect(top.totalCostUsd).toBeCloseTo(0.003);
  });
});

describe("topUsers", () => {
  it("returns highest-volume actors", () => {
    const events = [
      ev({ actor_id: "a" }),
      ev({ actor_id: "a" }),
      ev({ actor_id: "b" }),
      ev({ actor_id: null }),
    ];
    const top = topUsers(events, 5);
    expect(top[0].actorId).toBe("a");
    expect(top[0].count).toBe(2);
    expect(top).toHaveLength(2);
  });
});

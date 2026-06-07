import { describe, it, expect, vi } from "vitest";
import {
  recordUsageEvent,
  startTelemetry,
  withTelemetry,
  estimateCostUsd,
  type MinimalUsageClient,
} from "../telemetry";

function makeClient() {
  const inserts: Record<string, unknown>[] = [];
  const client: MinimalUsageClient = {
    from: () => ({
      insert: async (row: Record<string, unknown>) => {
        inserts.push(row);
        return { error: null };
      },
    }),
  };
  return { client, inserts };
}

describe("telemetry", () => {
  it("recordUsageEvent writes normalized row", async () => {
    const { client, inserts } = makeClient();
    await recordUsageEvent(
      client,
      {
        action: "chat.message",
        actorId: "u1",
        workspaceId: "w1",
        resourceType: "conversation",
        resourceId: "c1",
        metadata: { foo: "bar" },
      },
      {
        status: "success",
        durationMs: 1234,
        promptTokens: 10,
        completionTokens: 20,
        provider: "openai",
        model: "gpt-4o-mini",
        costUsd: 0.0042,
      },
    );
    expect(inserts).toHaveLength(1);
    const row = inserts[0];
    expect(row.action).toBe("chat.message");
    expect(row.actor_id).toBe("u1");
    expect(row.status).toBe("success");
    expect(row.duration_ms).toBe(1234);
    expect(row.prompt_tokens).toBe(10);
    expect(row.completion_tokens).toBe(20);
    expect(row.total_tokens).toBe(30);
    expect(row.provider).toBe("openai");
    expect(row.cost_usd).toBeCloseTo(0.0042);
    expect(row.metadata).toEqual({ foo: "bar" });
  });

  it("recordUsageEvent never throws when insert errors", async () => {
    const client: MinimalUsageClient = {
      from: () => ({
        insert: async () => {
          throw new Error("db down");
        },
      }),
    };
    await expect(
      recordUsageEvent(
        client,
        { action: "x", actorId: "u" },
        { status: "error", durationMs: 0 },
      ),
    ).resolves.toBeUndefined();
  });

  it("startTelemetry times the operation and only settles once", async () => {
    const { client, inserts } = makeClient();
    let t = 1000;
    const h = startTelemetry(
      client,
      { action: "op", actorId: "u" },
      () => t,
    );
    t = 1500;
    await h.success();
    await h.success(); // ignored
    expect(inserts).toHaveLength(1);
    expect(inserts[0].duration_ms).toBe(500);
    expect(inserts[0].status).toBe("success");
  });

  it("withTelemetry captures errors as error events and rethrows", async () => {
    const { client, inserts } = makeClient();
    const err = new Error("boom");
    await expect(
      withTelemetry(client, { action: "fail", actorId: "u" }, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].status).toBe("error");
    expect(inserts[0].error_message).toBe("boom");
  });

  it("withTelemetry runs extract() to pull token/cost data from result", async () => {
    const { client, inserts } = makeClient();
    const fn = vi.fn(async () => ({ value: 42, prompt: 5, completion: 7 }));
    const result = await withTelemetry(
      client,
      { action: "ok", actorId: "u" },
      fn,
      {
        extract: (r) => ({
          promptTokens: r.prompt,
          completionTokens: r.completion,
          provider: "openai",
          model: "gpt-4o-mini",
          costUsd: estimateCostUsd("gpt-4o-mini", r.prompt, r.completion),
        }),
      },
    );
    expect(result.value).toBe(42);
    expect(inserts[0].prompt_tokens).toBe(5);
    expect(inserts[0].completion_tokens).toBe(7);
    expect(inserts[0].total_tokens).toBe(12);
    expect(inserts[0].provider).toBe("openai");
    expect(Number(inserts[0].cost_usd)).toBeGreaterThan(0);
  });

  it("estimateCostUsd returns 0 for unknown models or missing data", () => {
    expect(estimateCostUsd(null, 100, 100)).toBe(0);
    expect(estimateCostUsd("unknown-model", 100, 100)).toBe(0);
    expect(estimateCostUsd("gpt-4o-mini", 0, 0)).toBe(0);
  });

  it("estimateCostUsd computes a positive cost for a known model", () => {
    const cost = estimateCostUsd("gpt-4o-mini", 1000, 1000);
    expect(cost).toBeGreaterThan(0);
    // 1000/1000*0.00015 + 1000/1000*0.0006 = 0.00075
    expect(cost).toBeCloseTo(0.00075, 6);
  });
});

import { describe, it, expect, vi } from "vitest";
import { enforceRateLimit, RateLimitError, RATE_LIMITS } from "../rateLimit";

function mockClient(result: unknown, error: { message: string } | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data: result, error }),
  };
}

describe("enforceRateLimit", () => {
  it("returns result when allowed", async () => {
    const c = mockClient({
      allowed: true,
      count: 1,
      limit: 30,
      remaining: 29,
      window_start: new Date().toISOString(),
      reset_at: new Date(Date.now() + 60000).toISOString(),
    });
    const res = await enforceRateLimit(c, "u1", RATE_LIMITS.chat);
    expect(res?.allowed).toBe(true);
    expect(c.rpc).toHaveBeenCalledWith(
      "check_rate_limit",
      expect.objectContaining({
        _user_id: "u1",
        _action: "chat.message",
        _max: 30,
        _window_seconds: 60,
      }),
    );
  });

  it("throws RateLimitError when not allowed", async () => {
    const c = mockClient({
      allowed: false,
      count: 31,
      limit: 30,
      remaining: 0,
      window_start: new Date().toISOString(),
      reset_at: new Date(Date.now() + 30000).toISOString(),
    });
    await expect(enforceRateLimit(c, "u1", RATE_LIMITS.chat)).rejects.toThrow(RateLimitError);
  });

  it("fails open when DB errors (best-effort)", async () => {
    const c = mockClient(null, { message: "rpc broken" });
    const res = await enforceRateLimit(c, "u1", RATE_LIMITS.report);
    expect(res).toBeNull();
  });

  it("has sensible default limits", () => {
    expect(RATE_LIMITS.chat.max).toBeGreaterThan(0);
    expect(RATE_LIMITS.report.windowSeconds).toBeGreaterThan(0);
  });
});

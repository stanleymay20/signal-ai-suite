import { describe, it, expect } from "vitest";
import { computeTrend } from "../trend";
import type { TimePoint } from "../types";

const tp = (t: string, v: number): TimePoint => ({ t, v, n: 1 });

describe("computeTrend", () => {
  it("returns null for fewer than 2 points", () => {
    expect(computeTrend([])).toBeNull();
    expect(computeTrend([tp("2024-01-01", 5)])).toBeNull();
  });

  it("detects an upward linear trend with R²≈1", () => {
    const pts = [0, 1, 2, 3, 4].map((i) => tp(new Date(2024, 0, 1 + i).toISOString(), i * 10));
    const r = computeTrend(pts)!;
    expect(r.direction).toBe("up");
    expect(r.slopePerDay).toBeCloseTo(10, 5);
    expect(r.rSquared).toBeGreaterThan(0.999);
    expect(r.changeAbs).toBe(40);
  });

  it("detects a downward trend", () => {
    const pts = [10, 8, 6, 4].map((v, i) => tp(new Date(2024, 0, 1 + i).toISOString(), v));
    const r = computeTrend(pts)!;
    expect(r.direction).toBe("down");
    expect(r.slopePerDay).toBeLessThan(0);
  });

  it("flags flat series as flat with low R²", () => {
    const pts = [5, 5, 5, 5].map((v, i) => tp(new Date(2024, 0, 1 + i).toISOString(), v));
    const r = computeTrend(pts)!;
    expect(r.direction).toBe("flat");
    expect(r.rSquared).toBe(0);
  });
});

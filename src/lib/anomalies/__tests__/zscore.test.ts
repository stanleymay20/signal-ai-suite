import { describe, it, expect } from "vitest";
import { detectZScore } from "../zscore";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
  v,
  n: 1,
});

describe("detectZScore", () => {
  it("returns empty for short series", () => {
    expect(detectZScore([tp(0, 1), tp(1, 2)])).toEqual([]);
  });

  it("flags a clear spike", () => {
    const base = Array.from({ length: 30 }, (_, i) => tp(i, 10));
    base[15] = tp(15, 1000);
    const out = detectZScore(base);
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out[0].method).toBe("zscore");
    expect(out[0].observed).toBe(1000);
    expect(out[0].expected).not.toBeNull();
    expect(out[0].severity).toBeDefined();
    expect(out[0].impactPct).not.toBeNull();
  });

  it("returns empty when std is zero", () => {
    const flat = Array.from({ length: 20 }, (_, i) => tp(i, 5));
    expect(detectZScore(flat)).toEqual([]);
  });

  it("respects threshold", () => {
    const base = Array.from({ length: 30 }, (_, i) => tp(i, 10 + (i % 3)));
    base[10] = tp(10, 30);
    const strict = detectZScore(base, { threshold: 10 });
    expect(strict.length).toBe(0);
  });
});

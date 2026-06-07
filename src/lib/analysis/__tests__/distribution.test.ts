import { describe, it, expect } from "vitest";
import { computeDistribution } from "../distribution";

describe("computeDistribution", () => {
  it("returns null when no numeric values", () => {
    expect(computeDistribution("c", [null, "", "abc"])).toBeNull();
  });

  it("computes summary stats and bins", () => {
    const vals = Array.from({ length: 100 }, (_, i) => i + 1); // 1..100
    const r = computeDistribution("c", vals, 10)!;
    expect(r.count).toBe(100);
    expect(r.min).toBe(1);
    expect(r.max).toBe(100);
    expect(r.mean).toBeCloseTo(50.5, 5);
    expect(r.median).toBeCloseTo(50.5, 5);
    expect(r.p25).toBeCloseTo(25.75, 5);
    expect(r.p75).toBeCloseTo(75.25, 5);
    expect(r.bins).toHaveLength(10);
    const total = r.bins.reduce((a, b) => a + b.count, 0);
    expect(total).toBe(100);
  });

  it("handles constant series as a single bin", () => {
    const r = computeDistribution("c", [5, 5, 5, 5])!;
    expect(r.bins).toHaveLength(1);
    expect(r.bins[0].count).toBe(4);
    expect(r.stddev).toBe(0);
  });

  it("coerces numeric strings", () => {
    const r = computeDistribution("c", ["1", "2", "3"])!;
    expect(r.count).toBe(3);
    expect(r.mean).toBe(2);
  });
});

import { describe, it, expect } from "vitest";
import { detectAnomalies } from "../anomalies";
import type { TimePoint } from "../types";

const tp = (i: number, v: number): TimePoint => ({ t: new Date(2024, 0, 1 + i).toISOString(), v, n: 1 });

describe("detectAnomalies", () => {
  it("returns no anomalies for short series", () => {
    expect(detectAnomalies([tp(0, 1), tp(1, 2)])).toEqual([]);
  });

  it("flags a large spike", () => {
    const base = Array.from({ length: 30 }, (_, i) => tp(i, 10));
    base[15] = tp(15, 1000);
    const a = detectAnomalies(base);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a[0].v).toBe(1000);
    expect(Math.abs(a[0].zScore)).toBeGreaterThanOrEqual(3);
  });

  it("returns empty when stddev is zero", () => {
    const flat = Array.from({ length: 20 }, (_, i) => tp(i, 5));
    expect(detectAnomalies(flat)).toEqual([]);
  });
});

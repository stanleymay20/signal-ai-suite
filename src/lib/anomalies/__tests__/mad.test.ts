import { describe, it, expect } from "vitest";
import { detectMad } from "../mad";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
  v,
  n: 1,
});

describe("detectMad", () => {
  it("flags an outlier in a small-noise series", () => {
    const base = Array.from({ length: 30 }, (_, i) => tp(i, 10 + (i % 2)));
    base[20] = tp(20, 200);
    const out = detectMad(base);
    expect(out.find((a) => a.observed === 200)).toBeTruthy();
    expect(out[0].method).toBe("mad");
  });

  it("returns empty for short series", () => {
    expect(detectMad([tp(0, 1), tp(1, 2)])).toEqual([]);
  });

  it("returns empty when MAD is zero", () => {
    const flat = Array.from({ length: 20 }, (_, i) => tp(i, 7));
    expect(detectMad(flat)).toEqual([]);
  });

  it("is more robust than z-score under heavy contamination", () => {
    // Mild jitter so MAD > 0, plus a few large outliers.
    const base = Array.from({ length: 20 }, (_, i) => tp(i, 10 + (i % 3)));
    for (const i of [3, 5, 7]) base[i] = tp(i, 100);
    const out = detectMad(base);
    expect(out.length).toBeGreaterThan(0);
  });
});

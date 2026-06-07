import { describe, it, expect } from "vitest";
import { detectIqr } from "../iqr";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
  v,
  n: 1,
});

describe("detectIqr", () => {
  it("flags points beyond Tukey fences", () => {
    const base = Array.from({ length: 20 }, (_, i) => tp(i, 10 + (i % 4)));
    base[5] = tp(5, 100);
    base[15] = tp(15, -100);
    const out = detectIqr(base);
    const vals = out.map((a) => a.observed).sort((a, b) => a - b);
    expect(vals).toContain(100);
    expect(vals).toContain(-100);
    expect(out[0].method).toBe("iqr");
  });

  it("returns empty when IQR is zero", () => {
    const flat = Array.from({ length: 20 }, (_, i) => tp(i, 5));
    expect(detectIqr(flat)).toEqual([]);
  });

  it("respects multiplier", () => {
    const base = Array.from({ length: 20 }, (_, i) => tp(i, 10 + (i % 4)));
    base[5] = tp(5, 20);
    const loose = detectIqr(base, { multiplier: 5 });
    expect(loose.length).toBe(0);
  });
});

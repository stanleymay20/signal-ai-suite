import { describe, it, expect } from "vitest";
import { detectRollingZ } from "../rollingZ";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(), v, n: 1,
});

describe("detectRollingZ", () => {
  it("detects a local spike on a trending series", () => {
    const base = Array.from({ length: 40 }, (_, i) => tp(i, 10 + i));
    base[25] = tp(25, 10 + 25 + 200);
    const out = detectRollingZ(base, { window: 8 });
    expect(out.find((a) => a.observed === 10 + 25 + 200)).toBeTruthy();
    expect(out[0].method).toBe("rolling_zscore");
  });

  it("returns empty for series shorter than window+2", () => {
    expect(detectRollingZ([tp(0, 1), tp(1, 2), tp(2, 3)], { window: 5 })).toEqual([]);
  });

  it("returns empty when window has zero variance", () => {
    const flat = Array.from({ length: 20 }, (_, i) => tp(i, 5));
    expect(detectRollingZ(flat, { window: 5 })).toEqual([]);
  });
});

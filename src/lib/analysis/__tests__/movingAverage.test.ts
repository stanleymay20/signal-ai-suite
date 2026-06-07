import { describe, it, expect } from "vitest";
import { movingAverage, defaultMovingAverageWindows } from "../movingAverage";
import type { TimePoint } from "../types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(2024, 0, 1 + i).toISOString(),
  v,
  n: 1,
});

describe("movingAverage", () => {
  it("returns null until window fills, then trailing average", () => {
    const pts = [1, 2, 3, 4, 5].map((v, i) => tp(i, v));
    const r = movingAverage(pts, 3);
    expect(r.window).toBe(3);
    expect(r.points.map((p) => p.ma)).toEqual([null, null, 2, 3, 4]);
  });
  it("handles window=1 as identity", () => {
    const pts = [1, 2, 3].map((v, i) => tp(i, v));
    const r = movingAverage(pts, 1);
    expect(r.points.map((p) => p.ma)).toEqual([1, 2, 3]);
  });
});

describe("defaultMovingAverageWindows", () => {
  it("returns empty for tiny series", () => {
    expect(defaultMovingAverageWindows(3)).toEqual([]);
  });
  it("scales with length", () => {
    expect(defaultMovingAverageWindows(10)).toEqual([3]);
    expect(defaultMovingAverageWindows(30)).toEqual([3, 7]);
    expect(defaultMovingAverageWindows(100)).toEqual([7, 30]);
  });
});

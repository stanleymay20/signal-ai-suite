import { describe, it, expect } from "vitest";
import {
  predictNaive,
  predictMovingAverage,
  predictLinearTrend,
  predictSeasonalNaive,
} from "../models";
import type { TimePoint } from "../../analysis/types";

const series = (vs: number[]): TimePoint[] =>
  vs.map((v, i) => ({ t: new Date(Date.UTC(2024, 0, i + 1)).toISOString(), v, n: 1 }));

const fts = (n: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.UTC(2024, 1, i + 1)).toISOString());

describe("models", () => {
  it("naive repeats last value", () => {
    const p = predictNaive(series([1, 2, 3, 7]), fts(3));
    expect(p.map((x) => x.yhat)).toEqual([7, 7, 7]);
  });
  it("moving_average uses last window", () => {
    const p = predictMovingAverage(series([1, 2, 3, 4, 5]), fts(2), 3);
    expect(p[0].yhat).toBeCloseTo(4);
    expect(p[1].yhat).toBeCloseTo(4);
  });
  it("linear_trend extrapolates a clean line", () => {
    const p = predictLinearTrend(series([1, 2, 3, 4, 5]), fts(2));
    expect(p[0].yhat).toBeCloseTo(6, 5);
    expect(p[1].yhat).toBeCloseTo(7, 5);
  });
  it("linear_trend falls back to naive for n<2", () => {
    expect(predictLinearTrend(series([5]), fts(2)).every((p) => p.yhat === 5)).toBe(true);
  });
  it("seasonal_naive repeats the seasonal pattern", () => {
    // period 3, history covers 2 cycles
    const h = series([10, 20, 30, 10, 20, 30]);
    const p = predictSeasonalNaive(h, fts(4), 3);
    expect(p.map((x) => x.yhat)).toEqual([10, 20, 30, 10]);
  });
  it("seasonal_naive falls back to naive when history shorter than period", () => {
    const p = predictSeasonalNaive(series([1, 2]), fts(2), 7);
    expect(p.every((x) => x.yhat === 2)).toBe(true);
  });
});

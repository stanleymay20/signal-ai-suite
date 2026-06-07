import { describe, it, expect } from "vitest";
import { runForecast } from "../runForecast";
import type { TimePoint } from "../../analysis/types";

function monthly(values: number[]): TimePoint[] {
  return values.map((v, i) => ({
    t: new Date(Date.UTC(2022, i, 1)).toISOString(),
    v,
    n: 1,
  }));
}

describe("runForecast backtest points", () => {
  it("includes per-timestamp backtest points for each model", () => {
    const vals = Array.from({ length: 24 }, (_, i) => 10 + 2 * i);
    const bundle = runForecast(monthly(vals), { horizon: 4, granularity: "month" });
    for (const m of bundle.models) {
      expect(Array.isArray(m.backtestPoints)).toBe(true);
      expect(m.backtestPoints.length).toBe(m.metrics.holdoutSize);
      for (const bp of m.backtestPoints) {
        expect(typeof bp.t).toBe("string");
        expect(Number.isFinite(bp.actual)).toBe(true);
        expect(Number.isFinite(bp.predicted)).toBe(true);
        expect(bp.residual).toBeCloseTo(bp.actual - bp.predicted, 10);
      }
    }
  });

  it("linear_trend backtest predicted values match the OLS extrapolation exactly", () => {
    // Perfect line: train fit recovers slope=2, intercept=10; holdout predicted
    // should equal the true linear value at each holdout timestamp.
    const vals = Array.from({ length: 20 }, (_, i) => 10 + 2 * i);
    const bundle = runForecast(monthly(vals), { horizon: 4, granularity: "month" });
    const linear = bundle.models.find((m) => m.model === "linear_trend")!;
    expect(linear.backtestPoints.length).toBeGreaterThan(0);
    const trainSize = vals.length - linear.metrics.holdoutSize;
    linear.backtestPoints.forEach((bp, k) => {
      const expected = 10 + 2 * (trainSize + k);
      expect(bp.predicted).toBeCloseTo(expected, 9);
      expect(bp.actual).toBe(expected);
      expect(bp.residual).toBeCloseTo(0, 9);
    });
  });

  it("empty backtestPoints when backtest cannot run", () => {
    const bundle = runForecast(monthly([5, 6, 7]), { horizon: 2, granularity: "month" });
    for (const m of bundle.models) {
      // holdoutSize may be 0 for very short series; if so, backtestPoints must also be empty.
      if (m.metrics.holdoutSize === 0) {
        expect(m.backtestPoints).toEqual([]);
      }
    }
  });
});

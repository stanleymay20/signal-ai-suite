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

describe("runForecast", () => {
  it("throws on empty series", () => {
    expect(() => runForecast([], { horizon: 3, granularity: "month" })).toThrow();
  });

  it("returns 4 model results for ample monthly history", () => {
    const vals = Array.from({ length: 36 }, (_, i) => 100 + i + 10 * Math.sin((i / 12) * Math.PI * 2));
    const bundle = runForecast(monthly(vals), { horizon: 6, granularity: "month" });
    expect(bundle.models.length).toBe(4);
    expect(bundle.horizon).toBe(6);
    expect(bundle.models[0].points.length).toBe(6);
    // future timestamps strictly after last historical bucket
    const lastHist = new Date(bundle.history[bundle.history.length - 1].t).getTime();
    const firstFuture = new Date(bundle.models[0].points[0].t).getTime();
    expect(firstFuture).toBeGreaterThan(lastHist);
  });

  it("recommends linear_trend on a strong linear series", () => {
    const vals = Array.from({ length: 24 }, (_, i) => 10 + 2 * i);
    const bundle = runForecast(monthly(vals), { horizon: 4, granularity: "month" });
    expect(bundle.best).toBe("linear_trend");
  });

  it("confidence intervals widen with horizon", () => {
    const vals = Array.from({ length: 24 }, (_, i) => 10 + i + (i % 3));
    const bundle = runForecast(monthly(vals), { horizon: 5, granularity: "month" });
    const linear = bundle.models.find((m) => m.model === "linear_trend")!;
    const widths = linear.intervals.map((iv) => iv.upper - iv.lower);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThanOrEqual(widths[i - 1]);
    }
  });

  it("skips seasonal_naive when history too short for a season", () => {
    const bundle = runForecast(monthly([1, 2, 3, 4]), { horizon: 2, granularity: "month" });
    expect(bundle.models.find((m) => m.model === "seasonal_naive")).toBeUndefined();
  });

  it("populates train range and assumptions", () => {
    const bundle = runForecast(monthly([1, 2, 3, 4, 5, 6, 7, 8]), { horizon: 2, granularity: "month" });
    expect(bundle.trainRange.count).toBe(8);
    expect(bundle.trainRange.start).toBeTruthy();
    expect(bundle.models[0].assumptions.length).toBeGreaterThan(0);
  });
});

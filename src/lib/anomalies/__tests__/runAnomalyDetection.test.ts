import { describe, it, expect } from "vitest";
import { runAnomalyDetection } from "../runAnomalyDetection";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(),
  v,
  n: 1,
});

describe("runAnomalyDetection", () => {
  it("returns empty bundle for empty series", () => {
    const b = runAnomalyDetection([]);
    expect(b.anomalies).toEqual([]);
    expect(b.summary.totalPoints).toBe(0);
  });

  it("aggregates multiple methods and summary counts", () => {
    const series = Array.from({ length: 40 }, (_, i) => tp(i, 10 + (i % 3)));
    series[20] = tp(20, 500);
    const b = runAnomalyDetection(series);
    expect(b.summary.totalAnomalies).toBeGreaterThan(0);
    const total = Object.values(b.summary.byMethod).reduce((a, c) => a + c, 0);
    expect(total).toBe(b.summary.totalAnomalies);
    const sev = Object.values(b.summary.bySeverity).reduce((a, c) => a + c, 0);
    expect(sev).toBe(b.summary.totalAnomalies);
    expect(b.methods).toContain("zscore");
    expect(b.methods).toContain("mad");
    expect(b.methods).toContain("iqr");
  });

  it("respects method filter", () => {
    const series = Array.from({ length: 30 }, (_, i) => tp(i, 10));
    series[10] = tp(10, 500);
    const b = runAnomalyDetection(series, { methods: ["iqr"] });
    expect(b.methods).toEqual(["iqr"]);
    for (const a of b.anomalies) expect(a.method).toBe("iqr");
  });

  it("includes forecast_residual only when forecast is provided", () => {
    const series = Array.from({ length: 12 }, (_, i) => tp(i, 100 + i));
    series[6] = tp(6, 1000);
    const expected = series.map((p, i) => ({ t: p.t, expected: 100 + i }));
    const b = runAnomalyDetection(series, {
      methods: ["forecast_residual"],
      forecast: { expected, residualStd: 5 },
    });
    expect(b.methods).toContain("forecast_residual");
    expect(b.anomalies.some((a) => a.method === "forecast_residual")).toBe(true);
  });

  it("sorts anomalies by timestamp", () => {
    const series = Array.from({ length: 40 }, (_, i) => tp(i, 10));
    series[5] = tp(5, 200);
    series[30] = tp(30, 200);
    const b = runAnomalyDetection(series);
    const ts = b.anomalies.map((a) => a.t);
    const sorted = [...ts].sort();
    expect(ts).toEqual(sorted);
  });
});

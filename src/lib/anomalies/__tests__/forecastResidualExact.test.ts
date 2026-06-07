import { describe, it, expect } from "vitest";
import { detectForecastResidual } from "../forecastResidual";
import { runForecast } from "../../forecasting/runForecast";
import type { TimePoint } from "../../analysis/types";

function monthly(values: number[]): TimePoint[] {
  return values.map((v, i) => ({
    t: new Date(Date.UTC(2022, i, 1)).toISOString(),
    v,
    n: 1,
  }));
}

describe("forecast_residual uses exact backtest expected values", () => {
  it("expected value at a flagged point equals the model's backtest prediction (not a holdout mean)", () => {
    // Strong linear series with a spike injected inside the holdout window.
    const vals = Array.from({ length: 24 }, (_, i) => 10 + 2 * i);
    const spikeIdx = 22;
    vals[spikeIdx] = vals[spikeIdx] + 200;
    const series = monthly(vals);

    const bundle = runForecast(series, { horizon: 4, granularity: "month" });
    const best = bundle.models.find((m) => m.model === bundle.best)!;
    // Sanity: backtest points exist with per-timestamp predictions.
    expect(best.backtestPoints.length).toBeGreaterThan(0);

    const expected = best.backtestPoints
      .filter((b) => Number.isFinite(b.predicted))
      .map((b) => ({ t: b.t, expected: b.predicted }));

    const out = detectForecastResidual(
      series,
      {
        expected,
        residualStd: best.residualStd,
      },
      { threshold: 1.5 },
    );

    const spikeT = series[spikeIdx].t;
    const flagged = out.find((a) => a.t === spikeT);
    expect(flagged).toBeTruthy();

    // The expected value the anomaly carries must equal the exact backtest
    // prediction for that timestamp — proving no mean-baseline approximation.
    const bp = best.backtestPoints.find((b) => b.t === spikeT)!;
    expect(flagged!.expected).toBe(bp.predicted);
    expect(flagged!.observed).toBe(series[spikeIdx].v);
    expect(flagged!.deviation).toBeCloseTo(series[spikeIdx].v - bp.predicted, 9);

    // And explicitly distinct from the holdout actual mean (the old approximation).
    const holdoutMean =
      series.slice(-best.metrics.holdoutSize).reduce((s, p) => s + p.v, 0) /
      best.metrics.holdoutSize;
    expect(flagged!.expected).not.toBe(holdoutMean);
  });
});

import type { Granularity, TimePoint } from "../analysis/types";
import { futureTimestamps, seasonalPeriod } from "./calendar";
import { computeMetrics, residualStd } from "./metrics";
import {
  ALL_MODELS,
  predictLinearTrend,
  predictMovingAverage,
  predictNaive,
  predictSeasonalNaive,
} from "./models";
import type {
  ConfidenceInterval,
  ForecastBundle,
  ForecastModel,
  ForecastPoint,
  ModelResult,
  TrainRange,
} from "./types";

export interface RunForecastOptions {
  horizon: number;
  granularity: Granularity;
  /** Window for the moving-average model. Defaults to min(6, n/3). */
  movingAverageWindow?: number;
  /** Fraction of history reserved for holdout. Defaults to 0.2 (capped 1..horizon). */
  holdoutFraction?: number;
  /** z multiplier for confidence band. 1.96 ≈ 95%. */
  zConfidence?: number;
  /** Restrict models. Defaults to all 4. */
  models?: ForecastModel[];
}

/** Z-multiplier default = 1.96 (≈95% CI under normality of residuals). */
const DEFAULT_Z = 1.96;

function generate(
  model: ForecastModel,
  history: TimePoint[],
  futureTs: string[],
  maWindow: number,
  period: number | null,
): ForecastPoint[] {
  switch (model) {
    case "naive": return predictNaive(history, futureTs);
    case "moving_average": return predictMovingAverage(history, futureTs, maWindow);
    case "linear_trend": return predictLinearTrend(history, futureTs);
    case "seasonal_naive":
      if (!period || history.length < period) return predictNaive(history, futureTs);
      return predictSeasonalNaive(history, futureTs, period);
  }
}

function buildIntervals(points: ForecastPoint[], std: number, z: number): ConfidenceInterval[] {
  if (std <= 0) return points.map((p) => ({ t: p.t, lower: p.yhat, upper: p.yhat }));
  // Widen with sqrt(h) so far-future bands are wider than near-future.
  return points.map((p, i) => {
    const w = z * std * Math.sqrt(i + 1);
    return { t: p.t, lower: p.yhat - w, upper: p.yhat + w };
  });
}

function modelAssumptions(model: ForecastModel, params: Record<string, number | string>): string[] {
  switch (model) {
    case "naive":
      return ["Future values equal the last observed value.", "No trend or seasonality is modelled."];
    case "moving_average":
      return [
        `Future values equal the mean of the last ${params.window} observations.`,
        "No trend or seasonality is modelled.",
      ];
    case "linear_trend":
      return [
        "A constant linear trend (OLS over bucket index) continues into the future.",
        "No seasonality is modelled; residuals are assumed roughly normal for the confidence band.",
      ];
    case "seasonal_naive":
      return [
        `Future values repeat the pattern from ${params.period} buckets ago.`,
        "Assumes a stable, repeating seasonal cycle and no underlying trend.",
      ];
  }
}

/** Run all models, score each on a holdout, generate forecasts on full history, recommend best. */
export function runForecast(history: TimePoint[], opts: RunForecastOptions): ForecastBundle {
  if (history.length === 0) {
    throw new Error("Cannot forecast an empty series");
  }
  if (opts.horizon < 1) throw new Error("Horizon must be at least 1");

  const granularity = opts.granularity;
  const period = seasonalPeriod(granularity);
  const z = opts.zConfidence ?? DEFAULT_Z;
  const enabled = opts.models ?? ALL_MODELS;

  const n = history.length;
  const maWindow = Math.max(2, Math.min(opts.movingAverageWindow ?? 6, Math.max(2, Math.floor(n / 3))));

  // Holdout split
  const holdoutCap = Math.min(opts.horizon, Math.max(1, Math.floor(n * (opts.holdoutFraction ?? 0.2))));
  const trainSize = n - holdoutCap;
  const canBacktest = trainSize >= 2 && holdoutCap >= 1;
  const train = canBacktest ? history.slice(0, trainSize) : history;
  const holdout = canBacktest ? history.slice(trainSize) : [];
  const holdoutTs = holdout.map((p) => p.t);
  const holdoutActual = holdout.map((p) => p.v);

  const futureTs = futureTimestamps(history[history.length - 1].t, granularity, opts.horizon);

  const results: ModelResult[] = [];
  for (const model of enabled) {
    // Skip seasonal_naive when we cannot honestly run it.
    if (model === "seasonal_naive" && (!period || history.length < period + 1)) continue;

    const params: Record<string, number | string> = {};
    if (model === "moving_average") params.window = maWindow;
    if (model === "seasonal_naive" && period) params.period = period;

    // Backtest predictions on holdout from train-only fit.
    const backtestPred = canBacktest
      ? generate(model, train, holdoutTs, maWindow, period).map((p) => p.yhat)
      : [];
    const metrics = canBacktest
      ? computeMetrics(holdoutActual, backtestPred)
      : { mae: null, rmse: null, mape: null, holdoutSize: 0 };
    const std = canBacktest ? residualStd(holdoutActual, backtestPred) : 0;

    // Final forecast uses full history.
    const points = generate(model, history, futureTs, maWindow, period);
    const intervals = buildIntervals(points, std, z);

    results.push({
      model,
      points,
      intervals,
      metrics,
      assumptions: modelAssumptions(model, params),
      residualStd: std,
      parameters: params,
    });
  }

  if (results.length === 0) throw new Error("No forecasting models could be run on this series");

  // Recommend best by lowest RMSE (fallback: MAE, then first).
  const best = [...results].sort((a, b) => {
    const ar = a.metrics.rmse ?? Number.POSITIVE_INFINITY;
    const br = b.metrics.rmse ?? Number.POSITIVE_INFINITY;
    if (ar !== br) return ar - br;
    const am = a.metrics.mae ?? Number.POSITIVE_INFINITY;
    const bm = b.metrics.mae ?? Number.POSITIVE_INFINITY;
    return am - bm;
  })[0].model;

  const trainRange: TrainRange = {
    start: history[0]?.t ?? null,
    end: history[history.length - 1]?.t ?? null,
    count: history.length,
    granularity,
  };

  return {
    best,
    models: results,
    trainRange,
    horizon: opts.horizon,
    granularity,
    history,
  };
}

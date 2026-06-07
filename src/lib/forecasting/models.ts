import type { TimePoint } from "../analysis/types";
import type { ForecastModel, ForecastPoint } from "./types";

/** Naive: every future value = last observed value. */
export function predictNaive(history: TimePoint[], futureTs: string[]): ForecastPoint[] {
  if (history.length === 0) return [];
  const last = history[history.length - 1].v;
  return futureTs.map((t) => ({ t, yhat: last }));
}

/** Moving average of the last `window` observations, held constant going forward. */
export function predictMovingAverage(
  history: TimePoint[],
  futureTs: string[],
  window: number,
): ForecastPoint[] {
  if (history.length === 0) return [];
  const w = Math.max(1, Math.min(window, history.length));
  let sum = 0;
  for (let i = history.length - w; i < history.length; i++) sum += history[i].v;
  const mean = sum / w;
  return futureTs.map((t) => ({ t, yhat: mean }));
}

/** Linear OLS on x=index, y=value; extrapolate. */
export function predictLinearTrend(
  history: TimePoint[],
  futureTs: string[],
): ForecastPoint[] {
  const n = history.length;
  if (n < 2) return predictNaive(history, futureTs);
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += history[i].v;
    sxx += i * i; sxy += i * history[i].v;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return predictNaive(history, futureTs);
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return futureTs.map((t, k) => ({ t, yhat: intercept + slope * (n + k) }));
}

/** Seasonal naive: yhat[t] = y[t - period]. */
export function predictSeasonalNaive(
  history: TimePoint[],
  futureTs: string[],
  period: number,
): ForecastPoint[] {
  if (history.length === 0 || period <= 0) return [];
  if (history.length < period) return predictNaive(history, futureTs);
  return futureTs.map((t, k) => {
    const src = history[history.length - period + (k % period)];
    return { t, yhat: src.v };
  });
}

export const ALL_MODELS: ForecastModel[] = [
  "naive",
  "moving_average",
  "linear_trend",
  "seasonal_naive",
];

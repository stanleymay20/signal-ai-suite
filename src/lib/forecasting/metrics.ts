import type { ForecastMetrics } from "./types";

export function mae(actual: number[], predicted: number[]): number | null {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return null;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(actual[i] - predicted[i]);
  return s / n;
}

export function rmse(actual: number[], predicted: number[]): number | null {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return null;
  let s = 0;
  for (let i = 0; i < n; i++) s += (actual[i] - predicted[i]) ** 2;
  return Math.sqrt(s / n);
}

/** MAPE in percent; returns null if any actual is 0 (undefined ratio). */
export function mape(actual: number[], predicted: number[]): number | null {
  const n = Math.min(actual.length, predicted.length);
  if (n === 0) return null;
  let s = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (actual[i] === 0) continue;
    s += Math.abs((actual[i] - predicted[i]) / actual[i]);
    count++;
  }
  if (count === 0) return null;
  return (s / count) * 100;
}

export function computeMetrics(actual: number[], predicted: number[]): ForecastMetrics {
  return {
    mae: mae(actual, predicted),
    rmse: rmse(actual, predicted),
    mape: mape(actual, predicted),
    holdoutSize: Math.min(actual.length, predicted.length),
  };
}

/** Sample standard deviation of residuals (actual - predicted). */
export function residualStd(actual: number[], predicted: number[]): number {
  const n = Math.min(actual.length, predicted.length);
  if (n < 2) return 0;
  const res = new Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    res[i] = actual[i] - predicted[i];
    mean += res[i];
  }
  mean /= n;
  let v = 0;
  for (let i = 0; i < n; i++) v += (res[i] - mean) ** 2;
  return Math.sqrt(v / (n - 1));
}

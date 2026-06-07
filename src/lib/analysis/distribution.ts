import type { DistributionResult, HistogramBin } from "./types";

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

function histogram(values: number[], binCount: number): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ start: min, end: max, count: values.length }];
  const width = (max - min) / binCount;
  const bins: HistogramBin[] = Array.from({ length: binCount }, (_, i) => ({
    start: min + i * width,
    end: min + (i + 1) * width,
    count: 0,
  }));
  for (const v of values) {
    let idx = Math.floor((v - min) / width);
    if (idx >= binCount) idx = binCount - 1;
    if (idx < 0) idx = 0;
    bins[idx].count++;
  }
  return bins;
}

/** Compute distribution stats + histogram for one numeric column. */
export function computeDistribution(
  column: string,
  rawValues: Array<unknown>,
  binCount = 20,
): DistributionResult | null {
  const nums: number[] = [];
  for (const v of rawValues) {
    if (v === null || v === undefined || v === "") continue;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) nums.push(n);
  }
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
  return {
    column,
    count: nums.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    median: quantile(sorted, 0.5),
    stddev: Math.sqrt(variance),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
    bins: histogram(nums, binCount),
  };
}

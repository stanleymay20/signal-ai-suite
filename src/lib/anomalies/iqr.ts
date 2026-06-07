import type { TimePoint } from "../analysis/types";
import { mean, quantile } from "./stats";
import { severityFromRatio, impactPct } from "./severity";
import type { AnomalyResult } from "./types";

export interface IqrOptions {
  multiplier?: number;
}

/** Tukey IQR fence anomaly detection (default k = 1.5). */
export function detectIqr(points: TimePoint[], opts: IqrOptions = {}): AnomalyResult[] {
  const k = opts.multiplier ?? 1.5;
  if (points.length < 8) return [];
  const vals = points.map((p) => p.v);
  const q1 = quantile(vals, 0.25);
  const q3 = quantile(vals, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [];
  const lower = q1 - k * iqr;
  const upper = q3 + k * iqr;
  const seriesMean = mean(vals);
  const median = quantile(vals, 0.5);
  const out: AnomalyResult[] = [];
  for (const p of points) {
    if (p.v < lower || p.v > upper) {
      const excess = p.v > upper ? (p.v - upper) : (lower - p.v);
      // ratio = how many IQR fence-widths beyond the fence (>=0); add 1 so threshold = 1.
      const ratio = 1 + excess / iqr;
      const deviation = p.v - median;
      out.push({
        t: p.t,
        observed: p.v,
        expected: median,
        deviation,
        method: "iqr",
        severity: severityFromRatio(ratio),
        score: Number(ratio.toFixed(3)),
        explanation: `Value falls outside Tukey fence [${lower.toFixed(2)}, ${upper.toFixed(2)}] (k=${k}).`,
        impactPct: impactPct(deviation, seriesMean),
      });
    }
  }
  return out;
}

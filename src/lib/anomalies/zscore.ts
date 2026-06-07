import type { TimePoint } from "../analysis/types";
import { mean, std } from "./stats";
import { severityFromRatio, impactPct } from "./severity";
import type { AnomalyResult } from "./types";

export interface ZScoreOptions {
  threshold?: number;
}

/** Global z-score anomaly detection. Requires at least 8 points and non-zero std. */
export function detectZScore(points: TimePoint[], opts: ZScoreOptions = {}): AnomalyResult[] {
  const threshold = opts.threshold ?? 3;
  if (points.length < 8) return [];
  const vals = points.map((p) => p.v);
  const mu = mean(vals);
  const sd = std(vals, mu);
  if (sd === 0) return [];
  const out: AnomalyResult[] = [];
  for (const p of points) {
    const z = (p.v - mu) / sd;
    if (Math.abs(z) >= threshold) {
      const deviation = p.v - mu;
      out.push({
        t: p.t,
        observed: p.v,
        expected: mu,
        deviation,
        method: "zscore",
        severity: severityFromRatio(z / threshold),
        score: Number(z.toFixed(3)),
        explanation: `Value deviates ${Math.abs(z).toFixed(2)}σ from the series mean (threshold ${threshold}σ).`,
        impactPct: impactPct(deviation, mu),
      });
    }
  }
  return out;
}

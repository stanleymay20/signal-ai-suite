import type { TimePoint } from "../analysis/types";
import { mean, std } from "./stats";
import { severityFromRatio, impactPct } from "./severity";
import type { AnomalyResult } from "./types";

export interface RollingZOptions {
  window?: number;
  threshold?: number;
}

/**
 * Rolling z-score: compare each point to the trailing window mean / std.
 * Captures local anomalies that global z-score misses on trending series.
 */
export function detectRollingZ(points: TimePoint[], opts: RollingZOptions = {}): AnomalyResult[] {
  const window = Math.max(3, opts.window ?? Math.max(5, Math.floor(points.length / 6)));
  const threshold = opts.threshold ?? 3;
  if (points.length < window + 2) return [];
  const vals = points.map((p) => p.v);
  const seriesMean = mean(vals);
  const out: AnomalyResult[] = [];
  for (let i = window; i < points.length; i++) {
    const slice = vals.slice(i - window, i);
    const mu = mean(slice);
    const sd = std(slice, mu);
    if (sd === 0) continue;
    const z = (vals[i] - mu) / sd;
    if (Math.abs(z) >= threshold) {
      const deviation = vals[i] - mu;
      out.push({
        t: points[i].t,
        observed: vals[i],
        expected: mu,
        deviation,
        method: "rolling_zscore",
        severity: severityFromRatio(z / threshold),
        score: Number(z.toFixed(3)),
        explanation: `${Math.abs(z).toFixed(2)}σ deviation from trailing ${window}-bucket window (threshold ${threshold}σ).`,
        impactPct: impactPct(deviation, seriesMean),
      });
    }
  }
  return out;
}

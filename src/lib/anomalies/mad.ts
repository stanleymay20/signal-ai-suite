import type { TimePoint } from "../analysis/types";
import { mad as madStat, mean } from "./stats";
import { severityFromRatio, impactPct } from "./severity";
import type { AnomalyResult } from "./types";

export interface MadOptions {
  threshold?: number;
}

/**
 * Robust modified-z anomaly detection using Median Absolute Deviation.
 * z_i = 0.6745 * (x_i - median) / MAD  (constant assumes ~normal data).
 * More robust to outliers than the classic z-score.
 */
export function detectMad(points: TimePoint[], opts: MadOptions = {}): AnomalyResult[] {
  const threshold = opts.threshold ?? 3.5;
  if (points.length < 8) return [];
  const vals = points.map((p) => p.v);
  const { median, mad } = madStat(vals);
  if (mad === 0) return [];
  const seriesMean = mean(vals);
  const out: AnomalyResult[] = [];
  for (const p of points) {
    const score = (0.6745 * (p.v - median)) / mad;
    if (Math.abs(score) >= threshold) {
      const deviation = p.v - median;
      out.push({
        t: p.t,
        observed: p.v,
        expected: median,
        deviation,
        method: "mad",
        severity: severityFromRatio(score / threshold),
        score: Number(score.toFixed(3)),
        explanation: `Modified z-score ${Math.abs(score).toFixed(2)} vs median (threshold ${threshold}).`,
        impactPct: impactPct(deviation, seriesMean),
      });
    }
  }
  return out;
}

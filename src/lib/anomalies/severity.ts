import type { AnomalySeverity } from "./types";

/**
 * Map a normalized "exceedance ratio" (score / threshold, always ≥ 1 for an
 * anomaly) to a severity bucket. Deterministic, method-agnostic.
 */
export function severityFromRatio(ratio: number): AnomalySeverity {
  const r = Math.abs(ratio);
  if (r >= 3) return "critical";
  if (r >= 2) return "high";
  if (r >= 1.5) return "medium";
  return "low";
}

export function impactPct(deviation: number | null, seriesMean: number | null): number | null {
  if (
    deviation === null ||
    seriesMean === null ||
    !Number.isFinite(seriesMean) ||
    seriesMean === 0
  ) {
    return null;
  }
  return Math.round((Math.abs(deviation) / Math.abs(seriesMean)) * 100);
}

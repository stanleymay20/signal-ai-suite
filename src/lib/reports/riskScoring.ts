/** Deterministic risk scoring from an EvidencePackage.
 *
 * Inputs: only persisted analysis artefacts. No model is involved.
 * Output: a 0-100 score, a banded level, and a list of plain-language drivers.
 *
 * Components (each contributes 0..1, weighted):
 *   - data quality      weight 0.20  → (100 - quality_score)/100
 *   - missingness       weight 0.10  → missingPct/100 (cap 1)
 *   - forecast error    weight 0.25  → MAPE/100 (cap 1); 0 if no forecast
 *   - anomaly severity  weight 0.35  → weighted count of high/critical anomalies
 *   - evidence gaps     weight 0.10  → fraction of missing evidence sources
 */

import type { EvidencePackage } from "../ai/retrieval";
import type { RiskScore } from "./types";

const WEIGHTS = {
  quality: 0.2,
  missing: 0.1,
  forecastError: 0.25,
  anomalies: 0.35,
  gaps: 0.1,
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function levelFor(score: number): RiskScore["level"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "elevated";
  if (score >= 20) return "moderate";
  return "low";
}

export function computeRiskScore(pkg: EvidencePackage): RiskScore {
  const drivers: string[] = [];

  // Data quality
  const qualityComponent = pkg.profile
    ? clamp01((100 - pkg.profile.qualityScore) / 100)
    : 0;
  if (pkg.profile && pkg.profile.qualityScore < 70) {
    drivers.push(`Data quality score ${pkg.profile.qualityScore}/100`);
  }

  // Missingness
  const missingComponent = pkg.profile ? clamp01(pkg.profile.missingPct / 100) : 0;
  if (pkg.profile && pkg.profile.missingPct >= 5) {
    drivers.push(`Missing cells: ${pkg.profile.missingPct.toFixed(1)}%`);
  }

  // Forecast error (MAPE preferred; fall back to RMSE-vs-mean if absent)
  let forecastComponent = 0;
  if (pkg.forecast) {
    const mape = pkg.forecast.metrics.mape;
    if (typeof mape === "number" && Number.isFinite(mape)) {
      forecastComponent = clamp01(mape / 100);
      if (mape >= 15) drivers.push(`Forecast MAPE ${mape.toFixed(1)}% on holdout`);
    }
  }

  // Anomalies
  let anomalyComponent = 0;
  if (pkg.anomalies) {
    const counts = pkg.anomalies.bySeverity ?? {};
    const critical = counts.critical ?? 0;
    const high = counts.high ?? 0;
    const medium = counts.medium ?? 0;
    // Weighted contribution, normalized by a soft cap of 10 weighted anomalies.
    const weighted = critical * 1 + high * 0.6 + medium * 0.25;
    anomalyComponent = clamp01(weighted / 10);
    if (critical > 0) drivers.push(`${critical} critical anomaly point(s)`);
    if (high > 0) drivers.push(`${high} high-severity anomaly point(s)`);
  }

  // Evidence gaps
  const present = [pkg.profile, pkg.analysis, pkg.forecast, pkg.anomalies].filter(Boolean).length;
  const gapsComponent = clamp01((4 - present) / 4);
  if (present < 4) drivers.push(`Evidence gaps: ${4 - present} pipeline stage(s) not yet run`);

  const raw =
    qualityComponent * WEIGHTS.quality +
    missingComponent * WEIGHTS.missing +
    forecastComponent * WEIGHTS.forecastError +
    anomalyComponent * WEIGHTS.anomalies +
    gapsComponent * WEIGHTS.gaps;

  const score = Math.round(clamp01(raw) * 100);
  return {
    score,
    level: levelFor(score),
    drivers,
  };
}

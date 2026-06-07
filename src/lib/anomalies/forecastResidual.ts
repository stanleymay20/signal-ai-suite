import type { TimePoint } from "../analysis/types";
import { mean } from "./stats";
import { severityFromRatio, impactPct } from "./severity";
import type { AnomalyResult, ForecastResidualSource } from "./types";

export interface ForecastResidualOptions {
  threshold?: number;
}

/**
 * Compare observed values to a forecast/backtest expected series. Points whose
 * residual exceeds `threshold * residualStd` are flagged.
 */
export function detectForecastResidual(
  points: TimePoint[],
  source: ForecastResidualSource,
  opts: ForecastResidualOptions = {},
): AnomalyResult[] {
  const threshold = opts.threshold ?? 3;
  if (!source || source.residualStd <= 0 || source.expected.length === 0) return [];
  const expectedMap = new Map(source.expected.map((e) => [e.t, e.expected]));
  const vals = points.map((p) => p.v);
  const seriesMean = mean(vals);
  const out: AnomalyResult[] = [];
  for (const p of points) {
    const exp = expectedMap.get(p.t);
    if (exp === undefined || !Number.isFinite(exp)) continue;
    const residual = p.v - exp;
    const z = residual / source.residualStd;
    if (Math.abs(z) >= threshold) {
      out.push({
        t: p.t,
        observed: p.v,
        expected: exp,
        deviation: residual,
        method: "forecast_residual",
        severity: severityFromRatio(z / threshold),
        score: Number(z.toFixed(3)),
        explanation: `Residual is ${Math.abs(z).toFixed(2)}× the forecast residual std (threshold ${threshold}).`,
        impactPct: impactPct(residual, seriesMean),
      });
    }
  }
  return out;
}

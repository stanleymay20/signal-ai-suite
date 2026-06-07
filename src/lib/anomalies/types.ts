import type { TimePoint } from "../analysis/types";

export type AnomalyMethod = "zscore" | "mad" | "iqr" | "rolling_zscore" | "forecast_residual";

export type AnomalySeverity = "low" | "medium" | "high" | "critical";

export interface AnomalyResult {
  /** ISO timestamp of the bucket */
  t: string;
  /** Observed value at t */
  observed: number;
  /** Expected/baseline value (null when method has no baseline) */
  expected: number | null;
  /** observed - expected (signed) */
  deviation: number | null;
  /** Method used to flag this point */
  method: AnomalyMethod;
  /** Normalized severity bucket */
  severity: AnomalySeverity;
  /** Raw method-specific score (z-score, modified-z, IQR multiplier, etc.) */
  score: number;
  /** Short human-readable explanation */
  explanation: string;
  /**
   * Estimated impact: deviation expressed as a percentage of the series mean
   * (absolute value, rounded). Null when the series mean is 0 or unavailable.
   */
  impactPct: number | null;
}

export interface MethodConfig {
  zscore?: { threshold?: number; enabled?: boolean };
  mad?: { threshold?: number; enabled?: boolean };
  iqr?: { multiplier?: number; enabled?: boolean };
  rollingZscore?: { window?: number; threshold?: number; enabled?: boolean };
  forecastResidual?: { threshold?: number; enabled?: boolean };
}

export interface ForecastResidualSource {
  /** Historical points with corresponding expected values (e.g. from backtest) */
  expected: Array<{ t: string; expected: number }>;
  /** Residual standard deviation used to score deviations */
  residualStd: number;
}

export interface AnomalySummary {
  totalPoints: number;
  totalAnomalies: number;
  byMethod: Record<AnomalyMethod, number>;
  bySeverity: Record<AnomalySeverity, number>;
  seriesMean: number | null;
  seriesStd: number | null;
}

export interface AnomalyBundle {
  series: TimePoint[];
  anomalies: AnomalyResult[];
  summary: AnomalySummary;
  methods: AnomalyMethod[];
}

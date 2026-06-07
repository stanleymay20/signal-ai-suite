import type {
  AnalysisResult,
  AnomalyPoint,
  CorrelationMatrix,
  Insight,
  MissingnessEntry,
  SeasonalityResult,
  TrendResult,
} from "./types";

function formatPct(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return "n/a";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

export function buildInsights(input: {
  targetColumn: string | null;
  granularity: string | null;
  pointCount: number;
  trend: TrendResult | null;
  seasonality: SeasonalityResult | null;
  correlation: CorrelationMatrix | null;
  missingness: MissingnessEntry[];
  anomalies: AnomalyPoint[];
}): Insight[] {
  const out: Insight[] = [];
  const target = input.targetColumn ?? "value";

  if (input.pointCount === 0) {
    out.push({
      severity: "warning",
      code: "no_series",
      message: "No time-series points could be computed from the chosen columns.",
    });
    return out;
  }

  if (input.trend) {
    const t = input.trend;
    if (t.direction === "flat") {
      out.push({
        severity: "info",
        code: "trend_flat",
        message: `"${target}" is essentially flat over the observed period.`,
      });
    } else {
      const fit = t.rSquared >= 0.6 ? "strong" : t.rSquared >= 0.3 ? "moderate" : "weak";
      out.push({
        severity: "info",
        code: `trend_${t.direction}`,
        message: `"${target}" trends ${t.direction} by ${formatPct(t.changePct)} (R²=${t.rSquared.toFixed(2)}, ${fit} fit).`,
      });
    }
  }

  if (input.seasonality?.detected && input.seasonality.strongest) {
    const label = input.seasonality.strongest === "monthOfYear" ? "monthly" : "day-of-week";
    out.push({
      severity: "info",
      code: "seasonality",
      message: `${label.charAt(0).toUpperCase()}${label.slice(1)} seasonality detected (strength ${input.seasonality.strength}).`,
    });
  }

  if (input.anomalies.length > 0) {
    out.push({
      severity: input.anomalies.length >= 3 ? "warning" : "info",
      code: "anomalies_present",
      message: `${input.anomalies.length} anomaly candidate${input.anomalies.length === 1 ? "" : "s"} detected (|z| ≥ 3).`,
    });
  }

  const worstMissing = [...input.missingness].sort((a, b) => b.percentage - a.percentage)[0];
  if (worstMissing && worstMissing.percentage >= 20) {
    out.push({
      severity: worstMissing.percentage >= 50 ? "warning" : "info",
      code: "missingness",
      message: `Column "${worstMissing.column}" is ${worstMissing.percentage}% missing.`,
    });
  }

  if (input.correlation) {
    const { columns, values } = input.correlation;
    let best: { a: string; b: string; r: number } | null = null;
    for (let i = 0; i < columns.length; i++) {
      for (let j = i + 1; j < columns.length; j++) {
        const r = values[i][j];
        if (r === null) continue;
        if (!best || Math.abs(r) > Math.abs(best.r)) best = { a: columns[i], b: columns[j], r };
      }
    }
    if (best && Math.abs(best.r) >= 0.7) {
      out.push({
        severity: "info",
        code: "strong_correlation",
        message: `Strong correlation between "${best.a}" and "${best.b}" (r=${best.r.toFixed(2)}).`,
      });
    }
  }

  return out;
}

export function summarizeResult(result: AnalysisResult): Insight[] {
  return buildInsights({
    targetColumn: result.targetColumn,
    granularity: result.granularity,
    pointCount: result.series.length,
    trend: result.trend,
    seasonality: result.seasonality,
    correlation: result.correlation,
    missingness: result.missingness,
    anomalies: result.anomalies,
  });
}

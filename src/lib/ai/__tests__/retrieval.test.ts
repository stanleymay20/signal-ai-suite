import { describe, expect, it } from "vitest";
import {
  buildAnalysisEvidence,
  buildAnomalyEvidence,
  buildEvidencePackage,
  buildForecastEvidence,
  buildProfileEvidence,
  deriveCitations,
  hasAnyEvidence,
} from "../retrieval";

describe("retrieval: builders", () => {
  it("buildProfileEvidence shapes summary + issues", () => {
    const p = buildProfileEvidence({
      quality_score: 87,
      summary_json: {
        rowCount: 1000,
        columnCount: 8,
        missingCellPercentage: 1.2,
        duplicateRowPercentage: 0,
        numericColumns: 4,
        dateColumns: 1,
        categoricalColumns: 3,
      },
      issues_json: [
        { code: "MISSING", severity: "warning", message: "some missing" },
        { code: "OUTLIER", severity: "info", message: "potential outlier" },
      ],
    });
    expect(p).not.toBeNull();
    expect(p!.qualityScore).toBe(87);
    expect(p!.rowCount).toBe(1000);
    expect(p!.topIssues).toHaveLength(2);
  });

  it("buildProfileEvidence returns null when missing", () => {
    expect(buildProfileEvidence(null)).toBeNull();
  });

  it("buildAnalysisEvidence extracts trend, seasonality, correlations", () => {
    const a = buildAnalysisEvidence({
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      date_column: "date",
      target_column: "sales",
      granularity: "month",
      results_json: {
        trend: { direction: "increasing", slope: 1.5, r2: 0.92 },
        seasonality: { detected: true, period: 12 },
        correlation: { topPairs: [{ a: "sales", b: "ads", r: 0.81 }] },
      },
      insights_json: ["Sales rising consistently"],
      anomalies_json: [{ t: "2025-08" }, { t: "2025-09" }],
    });
    expect(a!.trend?.direction).toBe("increasing");
    expect(a!.seasonality?.detected).toBe(true);
    expect(a!.correlationsTop?.[0].r).toBeCloseTo(0.81);
    expect(a!.baselineAnomalies).toBe(2);
  });

  it("buildForecastEvidence carries best model + comparison", () => {
    const f = buildForecastEvidence({
      id: "f1",
      created_at: "2026-01-01T00:00:00Z",
      horizon: 6,
      granularity: "month",
      model_name: "linear_trend",
      metrics: { rmse: 12.4, mae: 9.1, mape: 5.2 },
      model_comparison: [
        { name: "linear_trend", metrics: { rmse: 12.4, mae: 9.1 } },
        { name: "seasonal_naive", metrics: { rmse: 18.0, mae: 14.0 } },
      ],
      assumptions: ["holdout=20%", "no exogenous regressors"],
      forecast_points: new Array(6).fill({ t: "x", yhat: 0 }),
    });
    expect(f!.bestModel).toBe("linear_trend");
    expect(f!.models).toHaveLength(2);
    expect(f!.metrics.rmse).toBe(12.4);
    expect(f!.pointCount).toBe(6);
  });

  it("buildAnomalyEvidence ranks top by score and groups severity", () => {
    const x = buildAnomalyEvidence({
      id: "x1",
      created_at: "2026-01-01T00:00:00Z",
      methods: ["zscore", "mad"],
      summary: { total: 4 },
      anomalies: [
        { t: "2025-08", value: 100, severity: "high", method: "zscore", score: 4.2 },
        { t: "2025-09", value: 10, severity: "low", method: "mad", score: 2.0 },
        { t: "2025-10", value: 90, severity: "critical", method: "zscore", score: 6.1 },
        { t: "2025-11", value: 50, severity: "medium", method: "iqr", score: 3.0 },
      ],
    });
    expect(x!.total).toBe(4);
    expect(x!.top[0].t).toBe("2025-10"); // highest |score|
    expect(x!.bySeverity).toEqual({ high: 1, low: 1, critical: 1, medium: 1 });
  });
});

describe("retrieval: package + grounding", () => {
  const pkg = buildEvidencePackage({
    datasetId: "d1",
    datasetName: "sales.csv",
    profile: {
      quality_score: 90,
      summary_json: { rowCount: 100, columnCount: 5 },
      issues_json: [],
    },
    analysis: null,
    forecast: null,
    anomalyRun: null,
  });

  it("hasAnyEvidence true when profile present", () => {
    expect(hasAnyEvidence(pkg)).toBe(true);
  });

  it("hasAnyEvidence false when fully empty", () => {
    const empty = buildEvidencePackage({
      datasetId: "d",
      datasetName: "n",
      profile: null,
      analysis: null,
      forecast: null,
      anomalyRun: null,
    });
    expect(hasAnyEvidence(empty)).toBe(false);
  });
});

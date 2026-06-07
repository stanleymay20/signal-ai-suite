import { describe, expect, it } from "vitest";
import { buildEvidencePackage, type EvidencePackage } from "../../ai/retrieval";

export function fullPkg(): EvidencePackage {
  return buildEvidencePackage({
    datasetId: "d1",
    datasetName: "sales.csv",
    profile: {
      quality_score: 82,
      summary_json: {
        rowCount: 1200,
        columnCount: 8,
        missingCellPercentage: 6.2,
        duplicateRowPercentage: 0.5,
        numericColumns: 4,
        dateColumns: 1,
        categoricalColumns: 3,
      },
      issues_json: [
        { code: "missing_target", severity: "warning", message: "Target has 6% missing" },
      ],
    },
    analysis: {
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      date_column: "date",
      target_column: "sales",
      granularity: "month",
      results_json: {
        trend: { direction: "increasing", slope: 1.2, r2: 0.91 },
        seasonality: { detected: true, period: 12 },
      },
      insights_json: ["Strong upward trend", "Annual seasonality detected"],
      anomalies_json: [],
    },
    forecast: {
      id: "f1",
      created_at: "2026-01-02T00:00:00Z",
      horizon: 6,
      granularity: "month",
      model_name: "linear_trend",
      metrics: { rmse: 14.2, mae: 11.1, mape: 9.8 },
      model_comparison: [
        { name: "linear_trend", metrics: { rmse: 14.2, mae: 11.1, mape: 9.8 } },
        { name: "naive", metrics: { rmse: 22.4, mae: 18.0, mape: 17.5 } },
      ],
      assumptions: ["Assumes linear trend continues"],
      forecast_points: [],
    },
    anomalyRun: {
      id: "x1",
      created_at: "2026-01-03T00:00:00Z",
      methods: ["zscore", "mad"],
      summary: { total: 4 },
      anomalies: [
        { t: "2025-08", value: 220, expected: 140, severity: "critical", method: "zscore", score: 5.1 },
        { t: "2025-09", value: 200, expected: 145, severity: "high", method: "mad", score: 3.4 },
        { t: "2025-10", value: 180, expected: 150, severity: "medium", method: "zscore", score: 2.1 },
        { t: "2025-11", value: 170, expected: 152, severity: "medium", method: "mad", score: 1.6 },
      ],
    },
  });
}

export function emptyPkg(): EvidencePackage {
  return buildEvidencePackage({
    datasetId: "d2",
    datasetName: "empty.csv",
    profile: null,
    analysis: null,
    forecast: null,
    anomalyRun: null,
  });
}

// Type assertion the test file is a module.
describe("fixtures", () => {
  it("loads", () => {
    expect(fullPkg().profile?.qualityScore).toBe(82);
  });
});

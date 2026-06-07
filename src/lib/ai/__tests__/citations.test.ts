import { describe, expect, it } from "vitest";
import { buildEvidencePackage, deriveCitations } from "../retrieval";

function pkgWithEverything() {
  return buildEvidencePackage({
    datasetId: "d1",
    datasetName: "sales.csv",
    profile: {
      quality_score: 88,
      summary_json: { rowCount: 500, columnCount: 6, missingCellPercentage: 2 },
      issues_json: [],
    },
    analysis: {
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      date_column: "date",
      target_column: "sales",
      granularity: "month",
      results_json: {
        trend: { direction: "increasing", slope: 1.1, r2: 0.9 },
        seasonality: { detected: true, period: 12 },
      },
      insights_json: [],
      anomalies_json: [],
    },
    forecast: {
      id: "f1",
      created_at: "2026-01-02T00:00:00Z",
      horizon: 6,
      granularity: "month",
      model_name: "linear_trend",
      metrics: { rmse: 12.4, mae: 9.0, mape: 5 },
      model_comparison: [],
      assumptions: [],
      forecast_points: [],
    },
    anomalyRun: {
      id: "x1",
      created_at: "2026-01-03T00:00:00Z",
      methods: ["zscore"],
      summary: { total: 2 },
      anomalies: [
        { t: "2025-08", value: 100, expected: 60, severity: "high", method: "zscore", score: 4.0 },
        { t: "2025-09", value: 90, expected: 60, severity: "medium", method: "zscore", score: 2.5 },
      ],
    },
  });
}

describe("citations", () => {
  it("emits a citation for every present evidence source", () => {
    const pkg = pkgWithEverything();
    const cites = deriveCitations(pkg);
    const sources = new Set(cites.map((c) => c.source));
    expect(sources.has("profile")).toBe(true);
    expect(sources.has("analysis")).toBe(true);
    expect(sources.has("forecast")).toBe(true);
    expect(sources.has("anomaly")).toBe(true);
  });

  it("forecast citation carries best model and RMSE", () => {
    const cites = deriveCitations(pkgWithEverything());
    const fc = cites.find((c) => c.source === "forecast");
    expect(fc?.detail?.model).toBe("linear_trend");
    expect(fc?.detail?.rmse).toBe(12.4);
  });

  it("emits per-anomaly citations referencing the run id and timestamp", () => {
    const cites = deriveCitations(pkgWithEverything());
    const anomalyCites = cites.filter((c) => c.source === "anomaly");
    // 1 summary citation + up to 3 per-anomaly
    expect(anomalyCites.length).toBeGreaterThanOrEqual(2);
    const refs = anomalyCites.map((c) => c.ref);
    expect(refs.some((r) => r === "x1")).toBe(true);
    expect(refs.some((r) => r.startsWith("x1:"))).toBe(true);
  });

  it("emits no citations when evidence package is empty", () => {
    const pkg = buildEvidencePackage({
      datasetId: "d",
      datasetName: "n",
      profile: null,
      analysis: null,
      forecast: null,
      anomalyRun: null,
    });
    expect(deriveCitations(pkg)).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { buildEvidencePackage } from "../retrieval";
import { buildSystemMessage, renderEvidence, suggestFollowups, SYSTEM_PROMPT } from "../prompts";

function fullPkg() {
  return buildEvidencePackage({
    datasetId: "d1",
    datasetName: "sales.csv",
    profile: {
      quality_score: 88,
      summary_json: { rowCount: 500, columnCount: 6 },
      issues_json: [],
    },
    analysis: {
      id: "a1",
      created_at: "2026-01-01T00:00:00Z",
      date_column: "date",
      target_column: "sales",
      granularity: "month",
      results_json: { trend: { direction: "increasing", slope: 1, r2: 0.8 } },
      insights_json: [],
      anomalies_json: [],
    },
    forecast: {
      id: "f1",
      created_at: "2026-01-02T00:00:00Z",
      horizon: 6,
      granularity: "month",
      model_name: "linear_trend",
      metrics: { rmse: 10, mae: 8, mape: 5 },
      model_comparison: [],
      assumptions: [],
      forecast_points: [],
    },
    anomalyRun: {
      id: "x1",
      created_at: "2026-01-03T00:00:00Z",
      methods: ["zscore"],
      summary: { total: 1 },
      anomalies: [
        { t: "2025-08", value: 100, severity: "high", method: "zscore", score: 4 },
      ],
    },
  });
}

describe("evidence packaging", () => {
  it("renderEvidence mentions each present source by header", () => {
    const text = renderEvidence(fullPkg());
    expect(text).toContain("PROFILE:");
    expect(text).toContain("ANALYSIS");
    expect(text).toContain("FORECAST");
    expect(text).toContain("ANOMALIES");
    expect(text).toContain("sales.csv");
  });

  it("renderEvidence reports no evidence when package is empty", () => {
    const pkg = buildEvidencePackage({
      datasetId: "d",
      datasetName: "empty",
      profile: null,
      analysis: null,
      forecast: null,
      anomalyRun: null,
    });
    expect(renderEvidence(pkg)).toContain("(no evidence available yet)");
  });

  it("buildSystemMessage embeds the grounding rules and evidence", () => {
    const msg = buildSystemMessage(fullPkg());
    expect(msg).toContain(SYSTEM_PROMPT);
    expect(msg).toContain("EVIDENCE:");
    expect(msg).toContain("sales.csv");
  });

  it("suggestFollowups proposes runs for missing evidence", () => {
    const pkg = buildEvidencePackage({
      datasetId: "d",
      datasetName: "n",
      profile: {
        quality_score: 80,
        summary_json: { rowCount: 1, columnCount: 1 },
        issues_json: [],
      },
      analysis: null,
      forecast: null,
      anomalyRun: null,
    });
    const f = suggestFollowups(pkg);
    expect(f.some((s) => s.toLowerCase().includes("analysis"))).toBe(true);
    expect(f.some((s) => s.toLowerCase().includes("forecast"))).toBe(true);
    expect(f.some((s) => s.toLowerCase().includes("anomaly"))).toBe(true);
  });
});

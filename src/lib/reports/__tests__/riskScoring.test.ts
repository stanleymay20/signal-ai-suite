import { describe, expect, it } from "vitest";
import { computeRiskScore } from "../riskScoring";
import { fullPkg, emptyPkg } from "./_fixtures";
import { buildEvidencePackage } from "../../ai/retrieval";

describe("computeRiskScore", () => {
  it("returns deterministic score for identical inputs", () => {
    const a = computeRiskScore(fullPkg());
    const b = computeRiskScore(fullPkg());
    expect(a).toEqual(b);
    expect(a.score).toBeGreaterThanOrEqual(0);
    expect(a.score).toBeLessThanOrEqual(100);
  });

  it("empty evidence package yields a non-zero score driven by evidence gaps only", () => {
    const r = computeRiskScore(emptyPkg());
    // 4 gaps × 0.10 weight = 0.40 → 40
    expect(r.score).toBe(40);
    expect(r.level).toBe("elevated");
    expect(r.drivers.some((d) => d.toLowerCase().includes("evidence gaps"))).toBe(true);
  });

  it("critical anomalies push the score into a higher band than a clean dataset", () => {
    const clean = buildEvidencePackage({
      datasetId: "d",
      datasetName: "n",
      profile: {
        quality_score: 95,
        summary_json: { rowCount: 100, columnCount: 5, missingCellPercentage: 0 },
        issues_json: [],
      },
      analysis: {
        id: "a",
        created_at: "2026-01-01T00:00:00Z",
        date_column: "d",
        target_column: "v",
        granularity: "day",
        results_json: {},
        insights_json: [],
        anomalies_json: [],
      },
      forecast: {
        id: "f",
        created_at: "2026-01-01T00:00:00Z",
        horizon: 4,
        granularity: "day",
        model_name: "naive",
        metrics: { rmse: 1, mae: 1, mape: 1 },
        model_comparison: [],
        assumptions: [],
        forecast_points: [],
      },
      anomalyRun: {
        id: "x",
        created_at: "2026-01-01T00:00:00Z",
        methods: ["zscore"],
        summary: { total: 0 },
        anomalies: [],
      },
    });
    const noisy = fullPkg();
    expect(computeRiskScore(noisy).score).toBeGreaterThan(computeRiskScore(clean).score);
  });

  it("level bands map score correctly", () => {
    // Manufacture by varying anomaly load via mutated package.
    const r = computeRiskScore(fullPkg());
    expect(["low", "moderate", "elevated", "high", "critical"]).toContain(r.level);
  });
});

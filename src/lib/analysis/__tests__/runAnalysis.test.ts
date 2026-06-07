import { describe, it, expect } from "vitest";
import { runAnalysis } from "../runAnalysis";
import type { ColumnProfile } from "../../data-profiling/types";

function makeRows(n: number) {
  const rows: Array<Record<string, unknown>> = [];
  const start = new Date(Date.UTC(2023, 0, 1));
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    rows.push({
      ts: d.toISOString().slice(0, 10),
      revenue: 100 + i * 2 + Math.sin(i / 5) * 5,
      visitors: 50 + (i % 7) * 3,
      country: i % 3 === 0 ? "US" : "DE",
    });
  }
  return rows;
}

const cols: ColumnProfile[] = [
  { name: "ts", position: 0, dataType: "date", nullable: false, uniqueRatio: 1, missingPercentage: 0,
    stats: { count: 60, missing: 0, unique: 60 } },
  { name: "revenue", position: 1, dataType: "numeric", nullable: false, uniqueRatio: 0.9, missingPercentage: 0,
    stats: { count: 60, missing: 0, unique: 60, min: 100, max: 220 } },
  { name: "visitors", position: 2, dataType: "integer", nullable: false, uniqueRatio: 0.2, missingPercentage: 0,
    stats: { count: 60, missing: 0, unique: 7, min: 50, max: 68 } },
  { name: "country", position: 3, dataType: "categorical", nullable: false, uniqueRatio: 0.05, missingPercentage: 0,
    stats: { count: 60, missing: 0, unique: 2 } },
];

describe("runAnalysis", () => {
  it("produces a full analysis DTO end-to-end", () => {
    const rows = makeRows(60);
    const result = runAnalysis(rows, cols, { dateColumn: "ts", targetColumn: "revenue" });

    expect(result.targetColumn).toBe("revenue");
    expect(result.granularity).toBeTruthy();
    expect(result.series.length).toBeGreaterThan(0);
    expect(result.trend?.direction).toBe("up");
    expect(result.movingAverages.length).toBeGreaterThan(0);
    expect(result.seasonality).not.toBeNull();
    expect(result.distributions.find((d) => d.column === "revenue")).toBeTruthy();
    expect(result.correlation).not.toBeNull();
    expect(result.correlation!.columns).toEqual(expect.arrayContaining(["revenue", "visitors"]));
    expect(result.missingness.find((m) => m.column === "country")).toBeTruthy();
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("works when no date column is selected", () => {
    const rows = makeRows(20);
    const result = runAnalysis(rows, cols, { dateColumn: null, targetColumn: null });
    expect(result.series).toEqual([]);
    expect(result.trend).toBeNull();
    expect(result.distributions.length).toBeGreaterThan(0);
    expect(result.insights.some((i) => i.code === "no_series")).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { profileDataset } from "../profileDataset";

describe("profileDataset", () => {
  it("profiles a small mixed dataset end-to-end", () => {
    const columns = ["id", "country", "amount", "ts"];
    const rows = [
      { id: 1, country: "US", amount: 10.5, ts: "2024-01-01" },
      { id: 2, country: "US", amount: 20, ts: "2024-01-02" },
      { id: 3, country: "DE", amount: null, ts: "2024-01-03" },
      { id: 4, country: "DE", amount: 30, ts: "2024-01-04" },
      { id: 4, country: "DE", amount: 30, ts: "2024-01-04" }, // duplicate
    ];
    const p = profileDataset(rows, columns);

    expect(p.rowCount).toBe(5);
    expect(p.columnCount).toBe(4);
    expect(p.duplicateRowPercentage).toBeGreaterThan(0);
    expect(p.missingCellPercentage).toBeGreaterThan(0);

    const amount = p.columns.find((c) => c.name === "amount")!;
    expect(["numeric", "integer"]).toContain(amount.dataType);
    expect(amount.stats.min).toBe(10.5);
    expect(amount.stats.max).toBe(30);
    expect(amount.stats.mean).toBeGreaterThan(0);

    const ts = p.columns.find((c) => c.name === "ts")!;
    expect(["date", "datetime"]).toContain(ts.dataType);
    expect(typeof ts.stats.min).toBe("string");

    expect(p.qualityScore).toBeGreaterThanOrEqual(0);
    expect(p.qualityScore).toBeLessThanOrEqual(100);
  });

  it("handles empty rows", () => {
    const p = profileDataset([], ["a", "b"]);
    expect(p.rowCount).toBe(0);
    expect(p.columnCount).toBe(2);
    expect(p.qualityScore).toBeGreaterThanOrEqual(0);
    expect(p.issues.some((i) => i.code === "empty_dataset")).toBe(true);
  });
});

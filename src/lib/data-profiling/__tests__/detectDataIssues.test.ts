import { describe, it, expect } from "vitest";
import { detectDataIssues } from "../detectDataIssues";
import type { ColumnProfile } from "../types";

const col = (over: Partial<ColumnProfile> = {}): ColumnProfile => ({
  name: "c",
  position: 0,
  dataType: "string",
  nullable: false,
  uniqueRatio: 0.5,
  missingPercentage: 0,
  stats: { count: 10, missing: 0, unique: 5 },
  ...over,
});

describe("detectDataIssues", () => {
  it("flags empty dataset", () => {
    const issues = detectDataIssues({
      rowCount: 0,
      columnCount: 0,
      duplicateRowPercentage: 0,
      missingCellPercentage: 0,
      columns: [],
    });
    expect(issues.some((i) => i.code === "empty_dataset")).toBe(true);
    expect(issues.some((i) => i.code === "no_columns")).toBe(true);
  });
  it("flags high missing and duplicates", () => {
    const issues = detectDataIssues({
      rowCount: 100,
      columnCount: 1,
      duplicateRowPercentage: 10,
      missingCellPercentage: 40,
      columns: [col()],
    });
    expect(issues.some((i) => i.code === "high_missing_cells")).toBe(true);
    expect(issues.some((i) => i.code === "duplicate_rows")).toBe(true);
  });
  it("flags column-level problems", () => {
    const issues = detectDataIssues({
      rowCount: 10,
      columnCount: 3,
      duplicateRowPercentage: 0,
      missingCellPercentage: 0,
      columns: [
        col({ name: "a", missingPercentage: 60 }),
        col({ name: "b", uniqueRatio: 0, stats: { count: 10, missing: 0, unique: 1 } }),
        col({
          name: "c",
          dataType: "integer",
          uniqueRatio: 1,
          stats: { count: 10, missing: 0, unique: 10 },
        }),
        col({ name: "d", dataType: "unknown", stats: { count: 5, missing: 0, unique: 5 } }),
      ],
    });
    expect(issues.some((i) => i.code === "column_high_missing" && i.column === "a")).toBe(true);
    expect(issues.some((i) => i.code === "column_constant" && i.column === "b")).toBe(true);
    expect(issues.some((i) => i.code === "column_all_unique" && i.column === "c")).toBe(true);
    expect(issues.some((i) => i.code === "column_type_unknown" && i.column === "d")).toBe(true);
  });
});

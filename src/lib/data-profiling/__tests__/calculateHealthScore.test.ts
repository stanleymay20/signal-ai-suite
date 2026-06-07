import { describe, it, expect } from "vitest";
import { calculateHealthScore } from "../calculateHealthScore";
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

describe("calculateHealthScore", () => {
  it("returns 100 for a clean dataset", () => {
    expect(
      calculateHealthScore({
        missingCellPercentage: 0,
        duplicateRowPercentage: 0,
        columns: [col(), col({ name: "d" })],
        issues: [],
      }),
    ).toBe(100);
  });
  it("penalises missing cells", () => {
    const s = calculateHealthScore({
      missingCellPercentage: 20,
      duplicateRowPercentage: 0,
      columns: [col()],
      issues: [],
    });
    expect(s).toBeLessThan(100);
    expect(s).toBeGreaterThanOrEqual(0);
  });
  it("penalises duplicates", () => {
    const a = calculateHealthScore({
      missingCellPercentage: 0,
      duplicateRowPercentage: 0,
      columns: [col()],
      issues: [],
    });
    const b = calculateHealthScore({
      missingCellPercentage: 0,
      duplicateRowPercentage: 10,
      columns: [col()],
      issues: [],
    });
    expect(b).toBeLessThan(a);
  });
  it("penalises critical issues but stays >=0", () => {
    const s = calculateHealthScore({
      missingCellPercentage: 100,
      duplicateRowPercentage: 100,
      columns: [col({ dataType: "unknown" })],
      issues: [
        { severity: "critical", code: "x", message: "" },
        { severity: "critical", code: "y", message: "" },
        { severity: "critical", code: "z", message: "" },
      ],
    });
    expect(s).toBe(0);
  });
  it("clamps to 0..100 integer", () => {
    const s = calculateHealthScore({
      missingCellPercentage: 5,
      duplicateRowPercentage: 1,
      columns: [col()],
      issues: [],
    });
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });
});

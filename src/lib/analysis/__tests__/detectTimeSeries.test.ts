import { describe, it, expect } from "vitest";
import { detectTimeSeries } from "../detectTimeSeries";
import type { ColumnProfile } from "../../data-profiling/types";

const col = (over: Partial<ColumnProfile> = {}): ColumnProfile => ({
  name: "x",
  position: 0,
  dataType: "string",
  nullable: false,
  uniqueRatio: 0.5,
  missingPercentage: 0,
  stats: { count: 10, missing: 0, unique: 5 },
  ...over,
});

describe("detectTimeSeries", () => {
  it("suggests the highest-unique date and the widest-range numeric", () => {
    const r = detectTimeSeries([
      col({ name: "ts", dataType: "datetime", uniqueRatio: 0.95 }),
      col({ name: "month", dataType: "date", uniqueRatio: 0.1 }),
      col({
        name: "id",
        dataType: "integer",
        uniqueRatio: 1,
        stats: { count: 100, missing: 0, unique: 100, min: 1, max: 100 },
      }),
      col({
        name: "revenue",
        dataType: "numeric",
        uniqueRatio: 0.9,
        stats: { count: 100, missing: 0, unique: 90, min: 0, max: 5000 },
      }),
      col({
        name: "qty",
        dataType: "integer",
        uniqueRatio: 0.5,
        stats: { count: 100, missing: 0, unique: 10, min: 1, max: 20 },
      }),
    ]);
    expect(r.suggestedDate).toBe("ts");
    expect(r.suggestedTarget).toBe("revenue");
    expect(r.dateColumns).toContain("ts");
    expect(r.numericColumns).toEqual(expect.arrayContaining(["id", "revenue", "qty"]));
  });

  it("returns nulls when no candidates", () => {
    const r = detectTimeSeries([col({ name: "name", dataType: "string" })]);
    expect(r.suggestedDate).toBeNull();
    expect(r.suggestedTarget).toBeNull();
  });
});

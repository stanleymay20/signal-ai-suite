import { describe, it, expect } from "vitest";
import { buildSeries, chooseGranularity } from "../timeSeries";

describe("chooseGranularity", () => {
  it("picks day for short spans", () => {
    expect(chooseGranularity(new Date("2024-01-01"), new Date("2024-02-15"))).toBe("day");
  });
  it("picks month for ~year spans", () => {
    expect(chooseGranularity(new Date("2020-01-01"), new Date("2022-01-01"))).toBe("month");
  });
  it("picks year for very long spans", () => {
    expect(chooseGranularity(new Date("1990-01-01"), new Date("2024-01-01"))).toBe("year");
  });
});

describe("buildSeries", () => {
  it("aggregates by day with mean", () => {
    const rows = [
      { d: "2024-01-01", v: 10 },
      { d: "2024-01-01", v: 20 },
      { d: "2024-01-02", v: 30 },
    ];
    const r = buildSeries(rows, { dateColumn: "d", targetColumn: "v", granularity: "day" });
    expect(r.granularity).toBe("day");
    expect(r.points).toHaveLength(2);
    expect(r.points[0].v).toBe(15);
    expect(r.points[0].n).toBe(2);
    expect(r.points[1].v).toBe(30);
  });

  it("supports sum aggregation", () => {
    const rows = [
      { d: "2024-01-01", v: 10 },
      { d: "2024-01-01", v: 20 },
    ];
    const r = buildSeries(rows, { dateColumn: "d", targetColumn: "v", granularity: "day", aggregate: "sum" });
    expect(r.points[0].v).toBe(30);
  });

  it("skips rows with missing date or value", () => {
    const rows = [
      { d: "2024-01-01", v: 10 },
      { d: null, v: 20 },
      { d: "2024-01-02", v: null },
      { d: "bad-date", v: 5 },
    ];
    const r = buildSeries(rows, { dateColumn: "d", targetColumn: "v", granularity: "day" });
    expect(r.points).toHaveLength(1);
  });

  it("returns empty for no usable rows", () => {
    const r = buildSeries([], { dateColumn: "d", targetColumn: "v" });
    expect(r.points).toHaveLength(0);
  });

  it("outputs points ordered by time", () => {
    const rows = [
      { d: "2024-03-01", v: 3 },
      { d: "2024-01-01", v: 1 },
      { d: "2024-02-01", v: 2 },
    ];
    const r = buildSeries(rows, { dateColumn: "d", targetColumn: "v", granularity: "month" });
    expect(r.points.map((p) => p.v)).toEqual([1, 2, 3]);
  });
});

import { describe, it, expect } from "vitest";
import { advance, futureTimestamps, seasonalPeriod } from "../calendar";

describe("calendar", () => {
  it("advance handles month rollover", () => {
    expect(advance("2024-01-31T00:00:00.000Z", "month", 1)).toBe("2024-02-01T00:00:00.000Z");
  });
  it("advance handles day", () => {
    expect(advance("2024-01-01T00:00:00.000Z", "day", 3)).toBe("2024-01-04T00:00:00.000Z");
  });
  it("advance handles week, quarter, year", () => {
    expect(advance("2024-01-01T00:00:00.000Z", "week", 1)).toBe("2024-01-08T00:00:00.000Z");
    expect(advance("2024-01-01T00:00:00.000Z", "quarter", 1)).toBe("2024-04-01T00:00:00.000Z");
    expect(advance("2024-01-01T00:00:00.000Z", "year", 2)).toBe("2026-01-01T00:00:00.000Z");
  });
  it("seasonalPeriod maps granularities", () => {
    expect(seasonalPeriod("day")).toBe(7);
    expect(seasonalPeriod("month")).toBe(12);
    expect(seasonalPeriod("year")).toBeNull();
  });
  it("futureTimestamps generates contiguous future buckets", () => {
    const ts = futureTimestamps("2024-01-01T00:00:00.000Z", "month", 3);
    expect(ts).toEqual([
      "2024-02-01T00:00:00.000Z",
      "2024-03-01T00:00:00.000Z",
      "2024-04-01T00:00:00.000Z",
    ]);
  });
});

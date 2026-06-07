import { describe, it, expect } from "vitest";
import { computeSeasonality } from "../seasonality";
import type { TimePoint } from "../types";

function dailyPoints(months: number, base: number, seasonAmp: number): TimePoint[] {
  const out: TimePoint[] = [];
  const start = new Date(Date.UTC(2022, 0, 1));
  for (let i = 0; i < months * 30; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const m = d.getUTCMonth();
    const v = base + seasonAmp * Math.sin((m / 12) * 2 * Math.PI);
    out.push({ t: d.toISOString(), v, n: 1 });
  }
  return out;
}

describe("computeSeasonality", () => {
  it("detects monthly seasonality on a sinusoidal series", () => {
    const r = computeSeasonality(dailyPoints(24, 100, 30));
    expect(r.detected).toBe(true);
    expect(r.strongest).toBe("monthOfYear");
    expect(r.strength).toBeGreaterThan(0.1);
    expect(r.monthOfYear).toHaveLength(12);
  });

  it("reports near-zero strength on flat series", () => {
    const flat = dailyPoints(12, 50, 0);
    const r = computeSeasonality(flat);
    expect(r.strength).toBe(0);
    expect(r.detected).toBe(false);
  });

  it("always returns 7 day-of-week buckets", () => {
    const r = computeSeasonality(dailyPoints(2, 10, 0));
    expect(r.dayOfWeek).toHaveLength(7);
  });
});

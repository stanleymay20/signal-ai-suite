import { describe, it, expect } from "vitest";
import { mae, rmse, mape, computeMetrics, residualStd } from "../metrics";

describe("metrics", () => {
  it("mae returns null for empty inputs", () => {
    expect(mae([], [])).toBeNull();
  });
  it("mae averages absolute errors", () => {
    expect(mae([1, 2, 3], [2, 2, 5])).toBeCloseTo((1 + 0 + 2) / 3);
  });
  it("rmse averages squared errors then sqrt", () => {
    expect(rmse([1, 2, 3], [2, 2, 5])).toBeCloseTo(Math.sqrt((1 + 0 + 4) / 3));
  });
  it("mape skips zero actuals and is null when all zero", () => {
    expect(mape([0, 0], [1, 2])).toBeNull();
    expect(mape([100, 200], [110, 180])).toBeCloseTo((0.1 + 0.1) / 2 * 100);
  });
  it("computeMetrics returns holdoutSize", () => {
    const m = computeMetrics([1, 2], [1, 3]);
    expect(m.holdoutSize).toBe(2);
    expect(m.mae).toBeCloseTo(0.5);
  });
  it("residualStd is 0 for identical series", () => {
    expect(residualStd([1, 2, 3], [1, 2, 3])).toBe(0);
  });
  it("residualStd is positive when errors vary", () => {
    expect(residualStd([1, 2, 3, 4], [1, 3, 3, 5])).toBeGreaterThan(0);
  });
});

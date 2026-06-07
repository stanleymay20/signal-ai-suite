import { describe, it, expect } from "vitest";
import { detectForecastResidual } from "../forecastResidual";
import type { TimePoint } from "../../analysis/types";

const tp = (i: number, v: number): TimePoint => ({
  t: new Date(Date.UTC(2024, 0, 1 + i)).toISOString(), v, n: 1,
});

describe("detectForecastResidual", () => {
  it("flags points whose residual exceeds threshold * residualStd", () => {
    const points = Array.from({ length: 10 }, (_, i) => tp(i, 100 + i));
    points[5] = tp(5, 200);
    const expected = points.map((p, i) => ({ t: p.t, expected: 100 + i }));
    const out = detectForecastResidual(points, { expected, residualStd: 5 }, { threshold: 3 });
    expect(out.length).toBe(1);
    expect(out[0].observed).toBe(200);
    expect(out[0].expected).toBe(105);
    expect(out[0].method).toBe("forecast_residual");
  });

  it("returns empty when residualStd is 0", () => {
    const points = [tp(0, 1), tp(1, 2)];
    const out = detectForecastResidual(points, { expected: [{ t: points[0].t, expected: 1 }], residualStd: 0 });
    expect(out).toEqual([]);
  });

  it("skips points without a matching expected value", () => {
    const points = Array.from({ length: 5 }, (_, i) => tp(i, 10));
    points[0] = tp(0, 1000);
    const out = detectForecastResidual(points, { expected: [{ t: points[1].t, expected: 10 }], residualStd: 1 });
    expect(out.length).toBe(0);
  });
});

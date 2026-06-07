import type { TimePoint, TrendResult } from "./types";

/** Linear regression of v over time-in-days. */
export function computeTrend(points: TimePoint[]): TrendResult | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].t).getTime();
  const xs = points.map((p) => (new Date(p.t).getTime() - t0) / 86_400_000);
  const ys = points.map((p) => p.v);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    num += dx * dy; denX += dx * dx; denY += dy * dy;
  }
  if (denX === 0) return null;
  const slope = num / denX;
  const intercept = my - slope * mx;
  const r = denY === 0 ? 0 : num / Math.sqrt(denX * denY);
  const rSquared = r * r;

  const startValue = ys[0];
  const endValue = ys[n - 1];
  const changeAbs = endValue - startValue;
  const changePct = startValue !== 0 ? (changeAbs / Math.abs(startValue)) * 100 : null;
  const direction: TrendResult["direction"] =
    Math.abs(changeAbs) < 1e-9 ? "flat" : changeAbs > 0 ? "up" : "down";

  return { slopePerDay: slope, intercept, rSquared, startValue, endValue, changeAbs, changePct, direction };
}

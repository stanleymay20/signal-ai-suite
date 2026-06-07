import type { MovingAverageSeries, TimePoint } from "./types";

/** Trailing simple moving average. */
export function movingAverage(points: TimePoint[], window: number): MovingAverageSeries {
  if (window < 1) window = 1;
  const out: MovingAverageSeries["points"] = [];
  let sum = 0;
  const buf: number[] = [];
  for (const p of points) {
    buf.push(p.v);
    sum += p.v;
    if (buf.length > window) sum -= buf.shift() as number;
    out.push({ t: p.t, ma: buf.length === window ? sum / window : null });
  }
  return { window, points: out };
}

/** Pick reasonable MA windows based on series length. */
export function defaultMovingAverageWindows(length: number): number[] {
  if (length < 5) return [];
  if (length < 20) return [3];
  if (length < 60) return [3, 7];
  return [7, 30];
}

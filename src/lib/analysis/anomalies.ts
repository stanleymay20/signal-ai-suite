import type { AnomalyPoint, TimePoint } from "./types";

/** Z-score anomaly detection on a time series. */
export function detectAnomalies(points: TimePoint[], threshold = 3): AnomalyPoint[] {
  if (points.length < 8) return [];
  const ys = points.map((p) => p.v);
  const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
  const variance = ys.reduce((a, b) => a + (b - mean) ** 2, 0) / ys.length;
  const sd = Math.sqrt(variance);
  if (sd === 0) return [];
  const out: AnomalyPoint[] = [];
  for (const p of points) {
    const z = (p.v - mean) / sd;
    if (Math.abs(z) >= threshold) {
      out.push({ t: p.t, v: p.v, zScore: Number(z.toFixed(3)), method: "zscore" });
    }
  }
  return out;
}

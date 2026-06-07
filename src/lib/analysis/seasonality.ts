import type { SeasonalityBucket, SeasonalityResult, TimePoint } from "./types";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function meanBuckets(map: Map<number, { sum: number; n: number }>, labels: string[]): SeasonalityBucket[] {
  return labels.map((label, i) => {
    const e = map.get(i);
    return {
      key: String(i),
      label,
      mean: e && e.n > 0 ? e.sum / e.n : 0,
      count: e?.n ?? 0,
    };
  });
}

function cv(buckets: SeasonalityBucket[]): number {
  const active = buckets.filter((b) => b.count > 0);
  if (active.length < 2) return 0;
  const mean = active.reduce((a, b) => a + b.mean, 0) / active.length;
  if (mean === 0) return 0;
  const variance = active.reduce((a, b) => a + (b.mean - mean) ** 2, 0) / active.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

export function computeSeasonality(points: TimePoint[]): SeasonalityResult {
  const monthMap = new Map<number, { sum: number; n: number }>();
  const dowMap = new Map<number, { sum: number; n: number }>();

  for (const p of points) {
    const d = new Date(p.t);
    if (Number.isNaN(d.getTime())) continue;
    const m = d.getUTCMonth();
    const dowJsSunday = d.getUTCDay();
    const dow = (dowJsSunday + 6) % 7; // Mon=0..Sun=6
    const mb = monthMap.get(m) ?? { sum: 0, n: 0 };
    mb.sum += p.v; mb.n += 1; monthMap.set(m, mb);
    const db = dowMap.get(dow) ?? { sum: 0, n: 0 };
    db.sum += p.v; db.n += 1; dowMap.set(dow, db);
  }

  const monthOfYear = meanBuckets(monthMap, MONTH_LABELS);
  const dayOfWeek = meanBuckets(dowMap, DOW_LABELS);

  const cvMonth = cv(monthOfYear);
  const cvDow = cv(dayOfWeek);
  const monthsActive = monthOfYear.filter((b) => b.count > 0).length;
  const dowActive = dayOfWeek.filter((b) => b.count > 0).length;

  let strongest: SeasonalityResult["strongest"] = null;
  let strength = 0;
  if (monthsActive >= 6 && cvMonth >= cvDow) { strongest = "monthOfYear"; strength = cvMonth; }
  else if (dowActive >= 5) { strongest = "dayOfWeek"; strength = cvDow; }
  else if (monthsActive >= 3) { strongest = "monthOfYear"; strength = cvMonth; }

  const detected = strength >= 0.1;

  return { monthOfYear, dayOfWeek, detected, strongest, strength: Number(strength.toFixed(4)) };
}

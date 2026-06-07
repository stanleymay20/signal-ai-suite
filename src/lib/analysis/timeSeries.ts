import type { Granularity, TimePoint } from "./types";
import { isMissing } from "../data-profiling/inferColumnTypes";

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v);
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = day.getUTCDay(); // 0=Sun
  const diff = (dow + 6) % 7; // Monday-start
  day.setUTCDate(day.getUTCDate() - diff);
  return day;
}
function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(d.getUTCFullYear(), q, 1));
}
function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function bucket(d: Date, g: Granularity): Date {
  switch (g) {
    case "day":
      return startOfDay(d);
    case "week":
      return startOfWeek(d);
    case "month":
      return startOfMonth(d);
    case "quarter":
      return startOfQuarter(d);
    case "year":
      return startOfYear(d);
  }
}

/** Choose granularity based on observed time span. */
export function chooseGranularity(min: Date, max: Date): Granularity {
  const days = (max.getTime() - min.getTime()) / 86_400_000;
  if (days <= 60) return "day";
  if (days <= 365) return "week";
  if (days <= 365 * 3) return "month";
  if (days <= 365 * 10) return "quarter";
  return "year";
}

export interface BuildSeriesOptions {
  dateColumn: string;
  targetColumn: string;
  granularity?: Granularity;
  /** Aggregation strategy when multiple rows fall into the same bucket. */
  aggregate?: "mean" | "sum";
}

export interface BuildSeriesResult {
  granularity: Granularity;
  points: TimePoint[];
}

/** Aggregate (date, value) pairs into ordered buckets. */
export function buildSeries(
  rows: Array<Record<string, unknown>>,
  opts: BuildSeriesOptions,
): BuildSeriesResult {
  const aggregate = opts.aggregate ?? "mean";
  const pairs: Array<{ d: Date; v: number }> = [];
  for (const r of rows) {
    const rawD = r[opts.dateColumn];
    const rawV = r[opts.targetColumn];
    if (isMissing(rawD) || isMissing(rawV)) continue;
    const d = toDate(rawD);
    const v = toNumber(rawV);
    if (!d || v === null) continue;
    pairs.push({ d, v });
  }
  if (pairs.length === 0) return { granularity: opts.granularity ?? "day", points: [] };

  let min = pairs[0].d,
    max = pairs[0].d;
  for (const p of pairs) {
    if (p.d < min) min = p.d;
    if (p.d > max) max = p.d;
  }
  const g = opts.granularity ?? chooseGranularity(min, max);

  const buckets = new Map<number, { sum: number; n: number }>();
  for (const p of pairs) {
    const key = bucket(p.d, g).getTime();
    const b = buckets.get(key);
    if (b) {
      b.sum += p.v;
      b.n += 1;
    } else buckets.set(key, { sum: p.v, n: 1 });
  }

  const points: TimePoint[] = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, b]) => ({
      t: new Date(t).toISOString(),
      v: aggregate === "sum" ? b.sum : b.sum / b.n,
      n: b.n,
    }));

  return { granularity: g, points };
}

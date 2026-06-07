import type { Granularity } from "../analysis/types";

/** Advance an ISO timestamp by `step` units of the given granularity (UTC). */
export function advance(iso: string, granularity: Granularity, step = 1): string {
  const d = new Date(iso);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  let next: Date;
  switch (granularity) {
    case "day":
      next = new Date(Date.UTC(y, m, day + step));
      break;
    case "week":
      next = new Date(Date.UTC(y, m, day + step * 7));
      break;
    case "month":
      next = new Date(Date.UTC(y, m + step, 1));
      break;
    case "quarter":
      next = new Date(Date.UTC(y, m + step * 3, 1));
      break;
    case "year":
      next = new Date(Date.UTC(y + step, 0, 1));
      break;
  }
  return next.toISOString();
}

/** Seasonal period (in buckets) implied by a granularity, if any. */
export function seasonalPeriod(granularity: Granularity | null): number | null {
  switch (granularity) {
    case "day": return 7;
    case "week": return 52;
    case "month": return 12;
    case "quarter": return 4;
    default: return null;
  }
}

/** Build a sequence of future timestamps starting one step after `lastIso`. */
export function futureTimestamps(lastIso: string, granularity: Granularity, horizon: number): string[] {
  const out: string[] = [];
  let prev = lastIso;
  for (let i = 0; i < horizon; i++) {
    prev = advance(prev, granularity, 1);
    out.push(prev);
  }
  return out;
}

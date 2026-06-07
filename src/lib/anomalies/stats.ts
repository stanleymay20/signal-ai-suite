export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Population standard deviation. */
export function std(xs: number[], mu?: number): number {
  if (xs.length === 0) return 0;
  const m = mu ?? mean(xs);
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return Math.sqrt(v / xs.length);
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const m = Math.floor(n / 2);
  return n % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

/** Linear interpolation percentile (q in [0, 1]). */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Median absolute deviation around the median. */
export function mad(xs: number[]): { median: number; mad: number } {
  if (xs.length === 0) return { median: 0, mad: 0 };
  const med = median(xs);
  const abs = xs.map((x) => Math.abs(x - med));
  return { median: med, mad: median(abs) };
}

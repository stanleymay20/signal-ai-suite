import type { CorrelationMatrix } from "./types";

function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  let sx = 0,
    sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n,
    my = sy / n;
  let num = 0,
    dx2 = 0,
    dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx,
      dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return null;
  return num / Math.sqrt(dx2 * dy2);
}

/** Pairwise Pearson correlation across numeric columns, pairwise complete observations. */
export function correlationMatrix(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): CorrelationMatrix {
  // Pre-extract numeric vectors
  const cols: Record<string, Array<number | null>> = {};
  for (const c of columns) {
    cols[c] = rows.map((r) => {
      const v = r[c];
      if (v === null || v === undefined || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      return Number.isFinite(n) ? n : null;
    });
  }

  const values: Array<Array<number | null>> = columns.map(() => columns.map(() => null));
  for (let i = 0; i < columns.length; i++) {
    for (let j = i; j < columns.length; j++) {
      const a = cols[columns[i]],
        b = cols[columns[j]];
      const xs: number[] = [],
        ys: number[] = [];
      for (let k = 0; k < a.length; k++) {
        const av = a[k],
          bv = b[k];
        if (av !== null && bv !== null) {
          xs.push(av);
          ys.push(bv);
        }
      }
      const r = i === j ? (xs.length > 0 ? 1 : null) : pearson(xs, ys);
      values[i][j] = r === null ? null : Number(r.toFixed(4));
      values[j][i] = values[i][j];
    }
  }
  return { columns, values };
}

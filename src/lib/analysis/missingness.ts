import type { MissingnessEntry } from "./types";
import { isMissing } from "../data-profiling/inferColumnTypes";

export function computeMissingness(
  rows: Array<Record<string, unknown>>,
  columns: string[],
): MissingnessEntry[] {
  const total = rows.length;
  return columns.map((c) => {
    let missing = 0;
    for (const r of rows) if (isMissing(r[c])) missing++;
    return {
      column: c,
      missing,
      total,
      percentage: total > 0 ? Number(((missing / total) * 100).toFixed(2)) : 0,
    };
  });
}

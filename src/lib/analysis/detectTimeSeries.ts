import type { ColumnProfile } from "../data-profiling/types";

export interface TimeSeriesCandidates {
  dateColumns: string[];
  numericColumns: string[];
  suggestedDate: string | null;
  suggestedTarget: string | null;
}

/**
 * Suggest date + numeric target columns for time-series analysis.
 * Heuristic: prefer the date column with the highest unique ratio (often the primary timestamp)
 * and the numeric column with the largest value range (more analytically interesting).
 */
export function detectTimeSeries(columns: ColumnProfile[]): TimeSeriesCandidates {
  const dateColumns = columns
    .filter((c) => c.dataType === "date" || c.dataType === "datetime")
    .map((c) => c.name);
  const numericColumns = columns
    .filter((c) => c.dataType === "numeric" || c.dataType === "integer")
    .map((c) => c.name);

  const suggestedDate =
    columns
      .filter((c) => c.dataType === "date" || c.dataType === "datetime")
      .sort((a, b) => b.uniqueRatio - a.uniqueRatio)[0]?.name ?? null;

  const suggestedTarget =
    columns
      .filter((c) => c.dataType === "numeric" || c.dataType === "integer")
      .filter((c) => c.uniqueRatio > 0.05) // skip id-like or near-constant numerics
      .sort((a, b) => {
        const ra = numericRange(a);
        const rb = numericRange(b);
        return rb - ra;
      })[0]?.name ?? numericColumns[0] ?? null;

  return { dateColumns, numericColumns, suggestedDate, suggestedTarget };
}

function numericRange(c: ColumnProfile): number {
  const min = typeof c.stats.min === "number" ? c.stats.min : NaN;
  const max = typeof c.stats.max === "number" ? c.stats.max : NaN;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return 0;
  return Math.max(0, max - min);
}

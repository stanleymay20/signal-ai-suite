import type { ColumnProfile } from "../data-profiling/types";
import type { AnalysisResult, Granularity } from "./types";
import { buildSeries } from "./timeSeries";
import { computeTrend } from "./trend";
import { defaultMovingAverageWindows, movingAverage } from "./movingAverage";
import { computeSeasonality } from "./seasonality";
import { computeDistribution } from "./distribution";
import { correlationMatrix } from "./correlation";
import { computeMissingness } from "./missingness";
import { detectAnomalies } from "./anomalies";
import { buildInsights } from "./insights";

export interface RunAnalysisOptions {
  dateColumn: string | null;
  targetColumn: string | null;
  granularity?: Granularity;
  aggregate?: "mean" | "sum";
  /** Optional cap on numeric columns to include in correlation / distributions. */
  maxNumericColumns?: number;
}

/** Pure orchestration: takes parsed rows + column profiles, returns full analysis DTO. */
export function runAnalysis(
  rows: Array<Record<string, unknown>>,
  columns: ColumnProfile[],
  opts: RunAnalysisOptions,
): AnalysisResult {
  const cap = opts.maxNumericColumns ?? 12;
  const numericNames = columns
    .filter((c) => c.dataType === "numeric" || c.dataType === "integer")
    .slice(0, cap)
    .map((c) => c.name);

  let series: AnalysisResult["series"] = [];
  let granularity: Granularity | null = null;
  if (opts.dateColumn && opts.targetColumn) {
    const built = buildSeries(rows, {
      dateColumn: opts.dateColumn,
      targetColumn: opts.targetColumn,
      granularity: opts.granularity,
      aggregate: opts.aggregate ?? "mean",
    });
    series = built.points;
    granularity = built.granularity;
  }

  const trend = series.length >= 2 ? computeTrend(series) : null;
  const movingAverages = defaultMovingAverageWindows(series.length).map((w) =>
    movingAverage(series, w),
  );
  const seasonality = series.length >= 7 ? computeSeasonality(series) : null;

  const distributions = numericNames
    .map((c) =>
      computeDistribution(
        c,
        rows.map((r) => r[c]),
      ),
    )
    .filter((d): d is NonNullable<typeof d> => d !== null);

  const correlation = numericNames.length >= 2 ? correlationMatrix(rows, numericNames) : null;
  const missingness = computeMissingness(
    rows,
    columns.map((c) => c.name),
  );
  const anomalies = detectAnomalies(series);

  const insights = buildInsights({
    targetColumn: opts.targetColumn,
    granularity,
    pointCount: series.length,
    trend,
    seasonality,
    correlation,
    missingness,
    anomalies,
  });

  return {
    dateColumn: opts.dateColumn,
    targetColumn: opts.targetColumn,
    granularity,
    series,
    trend,
    movingAverages,
    seasonality,
    distributions,
    correlation,
    missingness,
    anomalies,
    insights,
  };
}

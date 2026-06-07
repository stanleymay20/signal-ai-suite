export type Granularity = "day" | "week" | "month" | "quarter" | "year";

export interface TimePoint {
  /** ISO date string at start of bucket */
  t: string;
  v: number;
  /** number of source rows aggregated into this bucket */
  n: number;
}

export interface TrendResult {
  slopePerDay: number;
  intercept: number;
  rSquared: number;
  startValue: number;
  endValue: number;
  changeAbs: number;
  changePct: number | null;
  direction: "up" | "down" | "flat";
}

export interface MovingAverageSeries {
  window: number;
  points: Array<{ t: string; ma: number | null }>;
}

export interface SeasonalityBucket {
  key: string;
  label: string;
  mean: number;
  count: number;
}

export interface SeasonalityResult {
  monthOfYear: SeasonalityBucket[];
  dayOfWeek: SeasonalityBucket[];
  detected: boolean;
  strongest: "monthOfYear" | "dayOfWeek" | null;
  /** Coefficient of variation of bucket means; higher = stronger seasonality */
  strength: number;
}

export interface HistogramBin {
  start: number;
  end: number;
  count: number;
}

export interface DistributionResult {
  column: string;
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stddev: number;
  p25: number;
  p75: number;
  bins: HistogramBin[];
}

export interface CorrelationMatrix {
  columns: string[];
  /** Square matrix, values in [-1, 1]; null when undefined (constant column) */
  values: Array<Array<number | null>>;
}

export interface MissingnessEntry {
  column: string;
  missing: number;
  total: number;
  percentage: number;
}

export interface AnomalyPoint {
  t: string;
  v: number;
  zScore: number;
  method: "zscore";
}

export interface Insight {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
}

export interface AnalysisResult {
  dateColumn: string | null;
  targetColumn: string | null;
  granularity: Granularity | null;
  series: TimePoint[];
  trend: TrendResult | null;
  movingAverages: MovingAverageSeries[];
  seasonality: SeasonalityResult | null;
  distributions: DistributionResult[];
  correlation: CorrelationMatrix | null;
  missingness: MissingnessEntry[];
  anomalies: AnomalyPoint[];
  insights: Insight[];
}

import type { Granularity, TimePoint } from "../analysis/types";

export type ForecastModel = "naive" | "moving_average" | "linear_trend" | "seasonal_naive";

export interface ForecastPoint {
  t: string;
  yhat: number;
}

export interface ConfidenceInterval {
  t: string;
  lower: number;
  upper: number;
}

export interface ForecastMetrics {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  holdoutSize: number;
}

export interface TrainRange {
  start: string | null;
  end: string | null;
  count: number;
  granularity: Granularity | null;
}

export interface ModelResult {
  model: ForecastModel;
  points: ForecastPoint[];
  intervals: ConfidenceInterval[];
  metrics: ForecastMetrics;
  assumptions: string[];
  residualStd: number;
  parameters: Record<string, number | string>;
}

export interface ForecastBundle {
  best: ForecastModel;
  models: ModelResult[];
  trainRange: TrainRange;
  horizon: number;
  granularity: Granularity | null;
  history: TimePoint[];
}

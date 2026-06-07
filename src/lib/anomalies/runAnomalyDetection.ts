import type { TimePoint } from "../analysis/types";
import { detectZScore } from "./zscore";
import { detectMad } from "./mad";
import { detectIqr } from "./iqr";
import { detectRollingZ } from "./rollingZ";
import { detectForecastResidual } from "./forecastResidual";
import { mean, std } from "./stats";
import type {
  AnomalyBundle, AnomalyMethod, AnomalyResult, AnomalySeverity,
  AnomalySummary, ForecastResidualSource, MethodConfig,
} from "./types";

export interface RunAnomalyOptions {
  methods?: AnomalyMethod[];
  config?: MethodConfig;
  forecast?: ForecastResidualSource | null;
}

const ALL_METHODS: AnomalyMethod[] = [
  "zscore", "mad", "iqr", "rolling_zscore", "forecast_residual",
];

function emptySummary(): AnomalySummary {
  return {
    totalPoints: 0,
    totalAnomalies: 0,
    byMethod: { zscore: 0, mad: 0, iqr: 0, rolling_zscore: 0, forecast_residual: 0 },
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    seriesMean: null,
    seriesStd: null,
  };
}

export function runAnomalyDetection(
  series: TimePoint[],
  opts: RunAnomalyOptions = {},
): AnomalyBundle {
  const requested = opts.methods ?? ALL_METHODS;
  const config = opts.config ?? {};
  const anomalies: AnomalyResult[] = [];
  const ran: AnomalyMethod[] = [];

  if (series.length === 0) {
    return { series, anomalies, summary: emptySummary(), methods: [] };
  }

  const vals = series.map((p) => p.v);
  const seriesMean = mean(vals);
  const seriesStd = std(vals, seriesMean);

  const include = (m: AnomalyMethod) => requested.includes(m);

  if (include("zscore") && config.zscore?.enabled !== false) {
    anomalies.push(...detectZScore(series, { threshold: config.zscore?.threshold }));
    ran.push("zscore");
  }
  if (include("mad") && config.mad?.enabled !== false) {
    anomalies.push(...detectMad(series, { threshold: config.mad?.threshold }));
    ran.push("mad");
  }
  if (include("iqr") && config.iqr?.enabled !== false) {
    anomalies.push(...detectIqr(series, { multiplier: config.iqr?.multiplier }));
    ran.push("iqr");
  }
  if (include("rolling_zscore") && config.rollingZscore?.enabled !== false) {
    anomalies.push(
      ...detectRollingZ(series, {
        window: config.rollingZscore?.window,
        threshold: config.rollingZscore?.threshold,
      }),
    );
    ran.push("rolling_zscore");
  }
  if (include("forecast_residual") && config.forecastResidual?.enabled !== false && opts.forecast) {
    anomalies.push(
      ...detectForecastResidual(series, opts.forecast, {
        threshold: config.forecastResidual?.threshold,
      }),
    );
    ran.push("forecast_residual");
  }

  // Stable ordering: timestamp asc, then method.
  anomalies.sort((a, b) => {
    if (a.t === b.t) return a.method.localeCompare(b.method);
    return a.t < b.t ? -1 : 1;
  });

  const summary: AnomalySummary = {
    totalPoints: series.length,
    totalAnomalies: anomalies.length,
    byMethod: { zscore: 0, mad: 0, iqr: 0, rolling_zscore: 0, forecast_residual: 0 },
    bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
    seriesMean,
    seriesStd,
  };
  for (const a of anomalies) {
    summary.byMethod[a.method] += 1;
    summary.bySeverity[a.severity as AnomalySeverity] += 1;
  }

  return { series, anomalies, summary, methods: ran };
}

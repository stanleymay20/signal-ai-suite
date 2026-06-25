# 06 — Anomaly Pipeline

Pure TypeScript, lives in `src/lib/anomalies/**`. Six unit-test files
cover the detectors and the orchestrator.

## Methods

| Method              | Idea                                                   | Notes                                                        |
| ------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `zscore`            | Distance from mean in units of σ                       | Sensitive to non-normality                                   |
| `mad`               | Median absolute deviation, scaled by 1.4826            | Robust to outliers in the calibration window                 |
| `iqr`               | Tukey fences (Q1 − 1.5·IQR, Q3 + 1.5·IQR)              | Non-parametric                                               |
| `rolling_z`         | Z-score over a moving window                           | Adapts to local level / variance                             |
| `forecast_residual` | Residual = actual − predicted, scaled by `residualStd` | Uses exact per-timestamp backtest predictions from Phase 4.1 |

Each detector returns a uniform shape:

```ts
interface Anomaly {
  t: string;
  observed: number;
  expected: number;
  deviation: number;
  score: number;
  severity: "low" | "medium" | "high" | "critical";
  method: AnomalyMethod;
  context?: Record<string, unknown>;
}
```

## Severity

`src/lib/anomalies/severity.ts` maps the method-specific score (z-score,
fence distance, scaled residual) into a four-level severity. Thresholds
are explicit constants — no model is involved.

## Orchestration

`runAnomalyDetection(series, methods, params)`:

1. validates method list and parameters
2. runs each detector independently
3. merges per-timestamp anomalies, keeping the highest-severity entry per
   `(t, method)` pair
4. returns `{ anomalies, summary, methods, parameters }`

The orchestrator never asks the model for help and never invents
anomalies. Empty results are returned as `[]`, not as a synthesized
explanation.

## Forecast-residual exactness (Phase 5.1)

The `forecast_residual` detector reads exact per-timestamp predictions
from `forecasts.backtest_points` (with a legacy fallback to
`model_comparison[].backtestPoints`). The previous mean-baseline
approximation has been deleted. A dedicated test
(`forecastResidualExact.test.ts`) asserts that the `expected` value on a
flagged point equals the model's exact backtest prediction and is
explicitly _not_ equal to the holdout mean.

## Audit

`anomaly.completed` and `anomaly.deleted` are written to `audit_logs`
under the acting user.

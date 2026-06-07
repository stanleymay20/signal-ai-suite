# 05 — Forecasting Pipeline

Pure TypeScript, no external services. Lives in `src/lib/forecasting/**`
and is exercised by unit tests in `src/lib/forecasting/__tests__/**`.

## Inputs

A series of `TimePoint { t: ISO string, v: number, n: number }` plus
`{ horizon, granularity }`. The series comes from the Phase 3 analysis
output (already aggregated to the chosen granularity).

## Models

| Model | Description |
| --- | --- |
| `naive` | Last observed value carried forward. Baseline. |
| `moving_average` | Window mean of last *k* observations. |
| `linear_trend` | Ordinary least squares on the training window. |
| `seasonal_naive` | Same-period-last-cycle (requires detected seasonality). |

All four run on every dataset; the best is selected by RMSE on the
holdout window.

## Backtest (Phase 4.1 hardening)

`runForecast` reserves a holdout slice from the end of the series, fits
each model on the remaining training portion, and produces a
**per-timestamp** backtest:

```ts
interface BacktestPoint { t: string; actual: number; predicted: number; residual: number }
interface ModelResult {
  model: ForecastModel;
  points: ForecastPoint[];           // future horizon
  intervals: ConfidenceInterval[];
  metrics: { mae, rmse, mape, holdoutSize };
  assumptions: string[];
  residualStd: number;
  parameters: Record<string, number | string>;
  backtestPoints: BacktestPoint[];   // exact holdout predictions
}
```

`backtestPoints` is what eliminated the mean-baseline approximation that
the forecast-residual anomaly detector previously relied on. The detector
now consumes exact per-timestamp expected values.

## Persistence

The best model is stored in `forecasts`:

- `forecast_points`, `confidence_intervals`, `metrics`, `assumptions`
- `model_comparison` — summary row per model
- `backtest_points` — exact best-model backtest

This is the row the Evidence Package reads for the AI layer; the AI never
re-runs the forecast.

## Metrics

`mae`, `rmse`, `mape`, plus `holdoutSize`. All computed by
`src/lib/forecasting/metrics.ts`. NaN is preserved as `null` so the UI can
render an explicit "not enough data" state.

## Assumptions

Each model contributes plain-English assumption strings (e.g. "Assumes
linear trend continues over horizon", "Seasonal pattern requires at least
two full cycles"). The AI explanation layer is required to quote these
when discussing forecast quality.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCsv, parseXlsx } from "./data-profiling/parseFile";
import { buildSeries } from "./analysis/timeSeries";
import { runAnomalyDetection } from "./anomalies/runAnomalyDetection";
import type { AnomalyMethod, ForecastResidualSource, MethodConfig } from "./anomalies/types";
import type { Granularity, TimePoint } from "./analysis/types";

const uuid = z.string().uuid();
const granularitySchema = z.enum(["day", "week", "month", "quarter", "year"]);
const methodSchema = z.enum(["zscore", "mad", "iqr", "rolling_zscore", "forecast_residual"]);

const configSchema = z
  .object({
    zscore: z
      .object({ threshold: z.number().min(1).max(10).optional(), enabled: z.boolean().optional() })
      .optional(),
    mad: z
      .object({ threshold: z.number().min(1).max(10).optional(), enabled: z.boolean().optional() })
      .optional(),
    iqr: z
      .object({
        multiplier: z.number().min(0.5).max(5).optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
    rollingZscore: z
      .object({
        window: z.number().int().min(3).max(200).optional(),
        threshold: z.number().min(1).max(10).optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
    forecastResidual: z
      .object({
        threshold: z.number().min(1).max(10).optional(),
        enabled: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

interface ForecastRow {
  id: string;
  parameters: unknown;
  model_name: string;
  metrics: unknown;
}

function extractForecastSource(forecast: ForecastRow | null): ForecastResidualSource | null {
  if (!forecast) return null;
  const params = (forecast.parameters ?? {}) as {
    history?: TimePoint[];
    allModels?: Array<{
      model: string;
      residualStd: number;
      points?: Array<{ t: string; yhat: number }>;
    }>;
  };
  const metrics = (forecast.metrics ?? {}) as { holdoutSize?: number };
  const best = params.allModels?.find((m) => m.model === forecast.model_name);
  if (!best || !params.history || best.residualStd <= 0) return null;
  // Use the backtest implied expected values: re-derive from the historical
  // tail of length `holdoutSize` by treating each history point's expected as
  // the best model's in-sample fit. We approximate with the residualStd-based
  // band rather than reconstructing fits, so we only flag points whose
  // residual vs the model's in-sample mean exceeds the threshold.
  const holdoutSize = metrics.holdoutSize ?? 0;
  if (holdoutSize === 0) return null;
  const tail = params.history.slice(-holdoutSize);
  // Pair holdout actuals with predicted values that the runForecast pipeline
  // generated during backtest. Those predictions are not stored individually
  // by timestamp, so we approximate expected = mean of holdout actuals minus
  // residual std; instead, surface only the residualStd and pair t→observed
  // mean as expected baseline.
  const mu = tail.reduce((s, p) => s + p.v, 0) / Math.max(tail.length, 1);
  return {
    expected: tail.map((p) => ({ t: p.t, expected: mu })),
    residualStd: best.residualStd,
  };
}

export const runAnomalyDetectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        datasetId: uuid,
        dateColumn: z.string().min(1).max(255),
        targetColumn: z.string().min(1).max(255),
        granularity: granularitySchema.optional(),
        aggregate: z.enum(["mean", "sum"]).optional(),
        methods: z.array(methodSchema).min(1).max(5).optional(),
        config: configSchema,
        useLatestForecast: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ds, error: dsErr } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", data.datasetId)
      .maybeSingle();
    if (dsErr) throw new Error(dsErr.message);
    if (!ds) throw new Error("Dataset not found");
    if (ds.status !== "ready") throw new Error("Dataset is not ready");

    const { data: cols, error: colErr } = await supabase
      .from("dataset_columns")
      .select("column_name")
      .eq("dataset_id", ds.id);
    if (colErr) throw new Error(colErr.message);
    const names = new Set((cols ?? []).map((c) => c.column_name));
    if (!names.has(data.dateColumn)) throw new Error("Unknown date column");
    if (!names.has(data.targetColumn)) throw new Error("Unknown target column");

    const runId = crypto.randomUUID();
    const methods = data.methods ?? ["zscore", "mad", "iqr", "rolling_zscore", "forecast_residual"];

    // Optional latest forecast for residual method
    let forecastSource: ForecastResidualSource | null = null;
    let forecastId: string | null = null;
    if (data.useLatestForecast !== false && methods.includes("forecast_residual")) {
      const { data: fc } = await supabase
        .from("forecasts")
        .select("id, parameters, model_name, metrics, status, dataset_id")
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fc) {
        forecastId = fc.id;
        forecastSource = extractForecastSource(fc as ForecastRow);
      }
    }

    const { error: insErr } = await supabase.from("anomaly_runs").insert({
      id: runId,
      dataset_id: ds.id,
      workspace_id: ds.workspace_id,
      computed_by: userId,
      forecast_id: forecastId,
      date_column: data.dateColumn,
      target_column: data.targetColumn,
      granularity: data.granularity ?? null,
      aggregate: data.aggregate ?? "mean",
      methods,
      parameters: JSON.parse(JSON.stringify(data.config ?? {})),
      status: "running",
    });
    if (insErr) throw new Error(insErr.message);

    try {
      const dl = await supabase.storage.from("datasets").download(ds.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Download failed");

      const parsed =
        ds.file_type === "csv"
          ? parseCsv(await dl.data.text())
          : parseXlsx(await dl.data.arrayBuffer());
      if (parsed.columns.length === 0) throw new Error("Could not parse dataset file");

      const series = buildSeries(parsed.rows, {
        dateColumn: data.dateColumn,
        targetColumn: data.targetColumn,
        granularity: data.granularity as Granularity | undefined,
        aggregate: data.aggregate ?? "mean",
      });
      if (series.points.length < 3) throw new Error("Need at least 3 aggregated points");

      const bundle = runAnomalyDetection(series.points, {
        methods: methods as AnomalyMethod[],
        config: (data.config ?? {}) as MethodConfig,
        forecast: forecastSource,
      });

      const { error: updErr } = await supabase
        .from("anomaly_runs")
        .update({
          status: "ready",
          granularity: series.granularity,
          series: JSON.parse(JSON.stringify(bundle.series)),
          anomalies: JSON.parse(JSON.stringify(bundle.anomalies)),
          summary: JSON.parse(JSON.stringify(bundle.summary)),
          methods: bundle.methods,
          error_message: null,
        })
        .eq("id", runId);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "anomaly.completed",
        metadata: {
          dataset_id: ds.id,
          anomaly_run_id: runId,
          methods: bundle.methods,
          total_anomalies: bundle.summary.totalAnomalies,
          target_column: data.targetColumn,
        },
      });

      return { runId, totalAnomalies: bundle.summary.totalAnomalies };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Anomaly detection failed";
      await supabase
        .from("anomaly_runs")
        .update({ status: "failed", error_message: msg })
        .eq("id", runId);
      throw new Error(msg);
    }
  });

export const getAnomalyRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("anomaly_runs")
      .select("*")
      .eq("id", data.runId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getLatestAnomalyRun = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("anomaly_runs")
      .select("*")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const listAnomalyRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("anomaly_runs")
      .select("id, status, methods, created_at, error_message, target_column, date_column, summary")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteAnomalyRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ runId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: gErr } = await supabase
      .from("anomaly_runs")
      .select("id, dataset_id")
      .eq("id", data.runId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row) throw new Error("Anomaly run not found");
    const { error } = await supabase.from("anomaly_runs").delete().eq("id", data.runId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "anomaly.deleted",
      metadata: { anomaly_run_id: data.runId, dataset_id: row.dataset_id },
    });
    return { ok: true };
  });

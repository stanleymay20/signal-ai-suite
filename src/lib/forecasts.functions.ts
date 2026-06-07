import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCsv, parseXlsx } from "./data-profiling/parseFile";
import { buildSeries } from "./analysis/timeSeries";
import { runForecast } from "./forecasting/runForecast";
import type { ForecastModel } from "./forecasting/types";
import { startTelemetry, type MinimalUsageClient } from "./observability/telemetry";
import { enforceRateLimit, RATE_LIMITS } from "./observability/rateLimit";

const uuid = z.string().uuid();
const granularitySchema = z.enum(["day", "week", "month", "quarter", "year"]);
const modelSchema = z.enum(["naive", "moving_average", "linear_trend", "seasonal_naive"]);

export const runDatasetForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        datasetId: uuid,
        dateColumn: z.string().min(1).max(255),
        targetColumn: z.string().min(1).max(255),
        granularity: granularitySchema.optional(),
        aggregate: z.enum(["mean", "sum"]).optional(),
        horizon: z.number().int().min(1).max(120),
        models: z.array(modelSchema).min(1).max(4).optional(),
        movingAverageWindow: z.number().int().min(2).max(60).optional(),
        holdoutFraction: z.number().min(0.05).max(0.5).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tele = startTelemetry(supabase as unknown as MinimalUsageClient, {
      action: "forecast.run",
      actorId: userId,
      resourceType: "dataset",
      resourceId: data.datasetId,
      metadata: { horizon: data.horizon, target: data.targetColumn },
    });

    try {
      await enforceRateLimit(supabase, userId, RATE_LIMITS.forecast);
    } catch (err) {
      await tele.error(err);
      throw err;
    }
    const { data: ds, error: dsErr } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", data.datasetId)
      .maybeSingle();
    if (dsErr) throw new Error(dsErr.message);
    if (!ds) throw new Error("Dataset not found");
    if (ds.status !== "ready") throw new Error("Dataset is not ready for forecasting");

    const { data: cols, error: colErr } = await supabase
      .from("dataset_columns")
      .select("column_name")
      .eq("dataset_id", ds.id);
    if (colErr) throw new Error(colErr.message);
    const names = new Set((cols ?? []).map((c) => c.column_name));
    if (!names.has(data.dateColumn)) throw new Error("Unknown date column");
    if (!names.has(data.targetColumn)) throw new Error("Unknown target column");

    const forecastId = crypto.randomUUID();
    const { error: insErr } = await supabase.from("forecasts").insert({
      id: forecastId,
      dataset_id: ds.id,
      workspace_id: ds.workspace_id,
      computed_by: userId,
      date_column: data.dateColumn,
      target_column: data.targetColumn,
      granularity: data.granularity ?? null,
      model_name: "pending",
      horizon: data.horizon,
      status: "running",
      parameters: {
        models: data.models ?? null,
        movingAverageWindow: data.movingAverageWindow ?? null,
        holdoutFraction: data.holdoutFraction ?? null,
        aggregate: data.aggregate ?? "mean",
      },
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
        granularity: data.granularity,
        aggregate: data.aggregate ?? "mean",
      });
      if (series.points.length < 3) {
        throw new Error("Need at least 3 aggregated points to forecast");
      }

      const bundle = runForecast(series.points, {
        horizon: data.horizon,
        granularity: series.granularity,
        models: data.models as ForecastModel[] | undefined,
        movingAverageWindow: data.movingAverageWindow,
        holdoutFraction: data.holdoutFraction,
      });

      const bestModel = bundle.models.find((m) => m.model === bundle.best)!;

      const comparison = bundle.models.map((m) => ({
        model: m.model,
        mae: m.metrics.mae,
        rmse: m.metrics.rmse,
        mape: m.metrics.mape,
        holdoutSize: m.metrics.holdoutSize,
        parameters: m.parameters,
        backtestPoints: m.backtestPoints,
      }));

      const { error: updErr } = await supabase
        .from("forecasts")
        .update({
          status: "ready",
          granularity: bundle.granularity,
          model_name: bundle.best,
          train_range: JSON.parse(JSON.stringify(bundle.trainRange)),
          forecast_points: JSON.parse(JSON.stringify(bestModel.points)),
          confidence_intervals: JSON.parse(JSON.stringify(bestModel.intervals)),
          metrics: JSON.parse(JSON.stringify(bestModel.metrics)),
          model_comparison: JSON.parse(JSON.stringify(comparison)),
          assumptions: JSON.parse(JSON.stringify(bestModel.assumptions)),
          backtest_points: JSON.parse(JSON.stringify(bestModel.backtestPoints)),
          parameters: JSON.parse(
            JSON.stringify({
              models: data.models ?? null,
              movingAverageWindow: data.movingAverageWindow ?? null,
              holdoutFraction: data.holdoutFraction ?? null,
              aggregate: data.aggregate ?? "mean",
              history: bundle.history,
              allModels: bundle.models,
            }),
          ),
          error_message: null,
        })
        .eq("id", forecastId);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "forecast.completed",
        metadata: {
          dataset_id: ds.id,
          forecast_id: forecastId,
          best_model: bundle.best,
          horizon: data.horizon,
          target_column: data.targetColumn,
        },
      });

      await tele.success({
        metadata: { forecast_id: forecastId, best_model: bundle.best },
      });
      return { forecastId, best: bundle.best };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Forecast failed";
      await supabase
        .from("forecasts")
        .update({ status: "failed", error_message: msg })
        .eq("id", forecastId);
      await tele.error(e, { metadata: { forecast_id: forecastId } });
      throw new Error(msg);
    }
  });

export const getForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ forecastId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("id", data.forecastId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const getLatestForecast = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const listForecasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("forecasts")
      .select(
        "id, model_name, horizon, granularity, status, created_at, error_message, target_column, date_column",
      )
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const deleteForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ forecastId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error: gErr } = await supabase
      .from("forecasts")
      .select("id, dataset_id, workspace_id")
      .eq("id", data.forecastId)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!row) throw new Error("Forecast not found");
    const { error } = await supabase.from("forecasts").delete().eq("id", data.forecastId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "forecast.deleted",
      metadata: { forecast_id: data.forecastId, dataset_id: row.dataset_id },
    });
    return { ok: true };
  });

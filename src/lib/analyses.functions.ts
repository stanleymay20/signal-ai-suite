import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseCsv, parseXlsx } from "./data-profiling/parseFile";
import { runAnalysis } from "./analysis/runAnalysis";
import type { ColumnProfile } from "./data-profiling/types";
import type { Granularity } from "./analysis/types";

const uuid = z.string().uuid();
const granularitySchema = z.enum(["day", "week", "month", "quarter", "year"]);

/** Run analysis: load file, parse, compute, persist. */
export const runDatasetAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      datasetId: uuid,
      dateColumn: z.string().min(1).max(255).nullable(),
      targetColumn: z.string().min(1).max(255).nullable(),
      granularity: granularitySchema.optional(),
      aggregate: z.enum(["mean", "sum"]).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ds, error: dsErr } = await supabase
      .from("datasets").select("*").eq("id", data.datasetId).maybeSingle();
    if (dsErr) throw new Error(dsErr.message);
    if (!ds) throw new Error("Dataset not found");
    if (ds.status !== "ready") throw new Error("Dataset is not ready for analysis");

    const { data: colRows, error: colErr } = await supabase
      .from("dataset_columns").select("*").eq("dataset_id", ds.id).order("position");
    if (colErr) throw new Error(colErr.message);
    if (!colRows || colRows.length === 0) throw new Error("Dataset has no column profile");

    const columns: ColumnProfile[] = colRows.map((c) => ({
      name: c.column_name,
      position: c.position,
      dataType: c.data_type,
      nullable: c.nullable,
      uniqueRatio: c.unique_ratio ?? 0,
      missingPercentage: c.missing_percentage ?? 0,
      stats: (c.stats ?? {}) as ColumnProfile["stats"],
    }));

    const colNames = new Set(columns.map((c) => c.name));
    if (data.dateColumn && !colNames.has(data.dateColumn)) throw new Error("Unknown date column");
    if (data.targetColumn && !colNames.has(data.targetColumn)) throw new Error("Unknown target column");

    // Insert a pending row early so the UI can poll status
    const analysisId = crypto.randomUUID();
    const { error: insErr } = await supabase.from("analyses").insert({
      id: analysisId,
      dataset_id: ds.id,
      workspace_id: ds.workspace_id,
      computed_by: userId,
      date_column: data.dateColumn,
      target_column: data.targetColumn,
      granularity: data.granularity ?? null,
      status: "running",
    });
    if (insErr) throw new Error(insErr.message);

    try {
      const dl = await supabase.storage.from("datasets").download(ds.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Download failed");

      let parsed;
      if (ds.file_type === "csv") {
        parsed = parseCsv(await dl.data.text());
      } else {
        parsed = parseXlsx(await dl.data.arrayBuffer());
      }
      if (parsed.columns.length === 0) throw new Error("Could not parse dataset file");

      const result = runAnalysis(parsed.rows, columns, {
        dateColumn: data.dateColumn,
        targetColumn: data.targetColumn,
        granularity: data.granularity,
        aggregate: data.aggregate,
      });

      const { error: updErr } = await supabase.from("analyses").update({
        status: "ready",
        granularity: result.granularity,
        results_json: JSON.parse(JSON.stringify(result)),
        insights_json: JSON.parse(JSON.stringify(result.insights)),
        anomalies_json: JSON.parse(JSON.stringify(result.anomalies)),
        error_message: null,
      }).eq("id", analysisId);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("audit_logs").insert({
        actor_id: userId,
        action: "analysis.completed",
        metadata: {
          dataset_id: ds.id,
          analysis_id: analysisId,
          target_column: data.targetColumn,
          insights: result.insights.length,
          anomalies: result.anomalies.length,
        },
      });

      return { analysisId, granularity: result.granularity, insightCount: result.insights.length };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      await supabase.from("analyses").update({ status: "failed", error_message: msg })
        .eq("id", analysisId);
      throw new Error(msg);
    }
  });

export const getLatestAnalysis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("analyses")
      .select("*")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    return rows?.[0] ?? null;
  });

export const listAnalyses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("analyses")
      .select("id, date_column, target_column, granularity, status, created_at, error_message")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

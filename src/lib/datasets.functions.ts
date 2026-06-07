import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { profileDataset } from "./data-profiling/profileDataset";
import { parseCsv, parseXlsx } from "./data-profiling/parseFile";

const fileTypeSchema = z.enum(["csv", "xlsx"]);
const uuid = z.string().uuid();

export const createDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspaceId: uuid,
      filename: z.string().min(1).max(255),
      fileType: fileTypeSchema,
      sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ws, error: wsErr } = await supabase
      .from("workspaces").select("id").eq("id", data.workspaceId).maybeSingle();
    if (wsErr) throw new Error(wsErr.message);
    if (!ws) throw new Error("Workspace not found or access denied");

    const datasetId = crypto.randomUUID();
    const safeName = data.filename.replace(/[^A-Za-z0-9._-]/g, "_");
    const storagePath = `${data.workspaceId}/${datasetId}/${safeName}`;

    const { error } = await supabase.from("datasets").insert({
      id: datasetId,
      workspace_id: data.workspaceId,
      uploaded_by: userId,
      filename: data.filename,
      file_type: data.fileType,
      storage_path: storagePath,
      size_bytes: data.sizeBytes,
      status: "uploading",
    });
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId, action: "dataset.created",
      metadata: { dataset_id: datasetId, workspace_id: data.workspaceId, filename: data.filename },
    });

    return { datasetId, storagePath };
  });

export const finalizeDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ds, error: dsErr } = await supabase
      .from("datasets").select("*").eq("id", data.datasetId).maybeSingle();
    if (dsErr) throw new Error(dsErr.message);
    if (!ds) throw new Error("Dataset not found");

    await supabase.from("datasets").update({ status: "profiling" }).eq("id", ds.id);

    try {
      const dl = await supabase.storage.from("datasets").download(ds.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Download failed");

      let parsed;
      if (ds.file_type === "csv") {
        const text = await dl.data.text();
        parsed = parseCsv(text);
      } else {
        const buf = await dl.data.arrayBuffer();
        parsed = parseXlsx(buf);
      }

      if (parsed.columns.length === 0) throw new Error("No columns detected in file");

      const profile = profileDataset(parsed.rows, parsed.columns);

      const { error: updErr } = await supabase.from("datasets").update({
        status: "ready",
        row_count: profile.rowCount,
        column_count: profile.columnCount,
        error_message: null,
      }).eq("id", ds.id);
      if (updErr) throw new Error(updErr.message);

      await supabase.from("dataset_columns").delete().eq("dataset_id", ds.id);
      const colRows = profile.columns.map((c) => ({
        dataset_id: ds.id,
        column_name: c.name,
        position: c.position,
        data_type: c.dataType,
        nullable: c.nullable,
        unique_ratio: c.uniqueRatio,
        missing_percentage: c.missingPercentage,
        stats: c.stats as unknown as Record<string, unknown>,
      }));
      if (colRows.length) {
        const { error: colErr } = await supabase.from("dataset_columns").insert(colRows);
        if (colErr) throw new Error(colErr.message);
      }

      const summary = {
        rowCount: profile.rowCount,
        columnCount: profile.columnCount,
        duplicateRowPercentage: profile.duplicateRowPercentage,
        missingCellPercentage: profile.missingCellPercentage,
        numericColumns: profile.numericColumns,
        categoricalColumns: profile.categoricalColumns,
        dateColumns: profile.dateColumns,
      };

      const { error: pErr } = await supabase.from("dataset_profiles").upsert({
        dataset_id: ds.id,
        summary_json: summary,
        quality_score: profile.qualityScore,
        issues_json: profile.issues,
      }, { onConflict: "dataset_id" });
      if (pErr) throw new Error(pErr.message);

      await supabase.from("audit_logs").insert({
        actor_id: userId, action: "dataset.profiled",
        metadata: { dataset_id: ds.id, quality_score: profile.qualityScore, rows: profile.rowCount },
      });

      return { ok: true as const, qualityScore: profile.qualityScore };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Profiling failed";
      await supabase.from("datasets").update({ status: "failed", error_message: msg }).eq("id", ds.id);
      throw new Error(msg);
    }
  });

export const listDatasets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ workspaceId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("datasets")
      .select("id, filename, file_type, status, row_count, column_count, size_bytes, created_at, error_message, dataset_profiles(quality_score)")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getDataset = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: dataset, error } = await supabase
      .from("datasets").select("*").eq("id", data.datasetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!dataset) throw new Error("Dataset not found");

    const [{ data: columns }, { data: profile }] = await Promise.all([
      supabase.from("dataset_columns").select("*").eq("dataset_id", data.datasetId).order("position"),
      supabase.from("dataset_profiles").select("*").eq("dataset_id", data.datasetId).maybeSingle(),
    ]);

    return { dataset, columns: columns ?? [], profile: profile ?? null };
  });

export const deleteDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ds, error } = await supabase
      .from("datasets").select("id, storage_path, workspace_id").eq("id", data.datasetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ds) throw new Error("Dataset not found");

    await supabase.storage.from("datasets").remove([ds.storage_path]);
    const { error: dErr } = await supabase.from("datasets").delete().eq("id", ds.id);
    if (dErr) throw new Error(dErr.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId, action: "dataset.deleted",
      metadata: { dataset_id: ds.id, workspace_id: ds.workspace_id },
    });
    return { ok: true as const };
  });

export const getDatasetSignedUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: ds, error } = await supabase
      .from("datasets").select("storage_path, filename").eq("id", data.datasetId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!ds) throw new Error("Dataset not found");
    const { data: signed, error: sErr } = await supabase.storage
      .from("datasets").createSignedUrl(ds.storage_path, 60 * 5, { download: ds.filename });
    if (sErr || !signed) throw new Error(sErr?.message ?? "Failed to sign URL");
    return { url: signed.signedUrl };
  });

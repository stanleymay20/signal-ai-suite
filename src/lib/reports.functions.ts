/** Reports server functions.
 *
 * Hybrid architecture:
 *   - deterministic ReportBuilder produces sections/KPIs/tables/citations/risk
 *   - AI narrative generator fills the narrative slots only
 *   - PDF/PPTX renderers consume the persisted ReportModel without re-calling AI
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildEvidencePackage,
  hasAnyEvidence,
  type EvidencePackage,
} from "./ai/retrieval";
import { resolveAIProvider } from "./ai/providers";
import {
  buildReport,
  generateNarratives,
  renderReportPdf,
  renderReportPptx,
  snapshotEvidence,
  type ReportModel,
  type ReportType,
} from "./reports";

const uuid = z.string().uuid();
const reportType = z.enum([
  "executive_summary",
  "boardroom",
  "risk_brief",
  "forecast_brief",
  "anomaly_investigation",
]) satisfies z.ZodType<ReportType>;

function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function bytesToBase64(bytes: Uint8Array): string {
  // Worker + browser-safe base64 encoder (no Buffer required at the type level).
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  // btoa exists in Workers and Node ≥16.
  // eslint-disable-next-line no-undef
  return btoa(bin);
}

// Loading evidence is inlined inside generateReport to avoid leaking the
// Supabase client's generic type through a helper signature.

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ datasetId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("id, type, title, risk_score, ai_model, ai_provider, created_at, updated_at")
      .eq("dataset_id", data.datasetId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found");
    return row;
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("reports")
      .select("dataset_id, type")
      .eq("id", data.reportId)
      .maybeSingle();
    const { error } = await supabase.from("reports").delete().eq("id", data.reportId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "report.deleted",
      metadata: { report_id: data.reportId, dataset_id: row?.dataset_id, type: row?.type },
    });
    return { ok: true };
  });

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ datasetId: uuid, type: reportType }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: ds, error: dErr } = await supabase
      .from("datasets")
      .select("id, filename, workspace_id")
      .eq("id", data.datasetId)
      .maybeSingle();
    if (dErr) throw new Error(dErr.message);
    if (!ds) throw new Error("Dataset not found");

    const [profileQ, analysisQ, forecastQ, anomalyQ] = await Promise.all([
      supabase
        .from("dataset_profiles")
        .select("quality_score, summary_json, issues_json")
        .eq("dataset_id", ds.id)
        .maybeSingle(),
      supabase
        .from("analyses")
        .select(
          "id, created_at, date_column, target_column, granularity, results_json, insights_json, anomalies_json",
        )
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("forecasts")
        .select(
          "id, created_at, horizon, granularity, model_name, metrics, model_comparison, assumptions, forecast_points",
        )
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("anomaly_runs")
        .select("id, created_at, methods, summary, anomalies")
        .eq("dataset_id", ds.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const pkg: EvidencePackage = buildEvidencePackage({
      datasetId: ds.id,
      datasetName: ds.filename,
      profile: profileQ.data ?? null,
      analysis: analysisQ.data?.[0] ?? null,
      forecast: forecastQ.data?.[0] ?? null,
      anomalyRun: anomalyQ.data?.[0] ?? null,
    });

    if (!hasAnyEvidence(pkg)) {
      throw new Error(
        "No evidence available yet. Run profile, analysis, forecast, or anomaly detection first.",
      );
    }

    const now = new Date();
    const baseReport = buildReport({ type: data.type, pkg, now });

    // Fill narrative slots (best-effort; never invents deterministic fields).
    const provider = resolveAIProvider({
      AI_PROVIDER: process.env.AI_PROVIDER,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      LOVABLE_API_KEY: process.env.LOVABLE_API_KEY,
    });
    const narrated = await generateNarratives({ report: baseReport, pkg, provider });

    const snapshot = snapshotEvidence(pkg, now.toISOString());

    const insertPayload = {
      workspace_id: ds.workspace_id,
      dataset_id: data.datasetId,
      created_by: userId,
      type: data.type,
      title: narrated.report.title,
      sections: toJson(narrated.report.sections),
      narratives: toJson(narrated.narratives),
      citations: toJson(narrated.report.citations),
      risk_score: toJson(narrated.report.risk),
      evidence_snapshot: toJson(snapshot),
      ai_model: narrated.model,
      ai_provider: narrated.provider,
    } as never;

    const { data: row, error } = await supabase
      .from("reports")
      .insert(insertPayload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "report.generated",
      metadata: {
        report_id: row.id,
        dataset_id: data.datasetId,
        type: data.type,
        risk_score: narrated.report.risk.score,
        ai_provider: narrated.provider,
        ai_model: narrated.model,
      },
    });

    return { report: row };
  });

function rowToReportModel(row: {
  type: ReportType;
  title: string;
  dataset_id: string;
  evidence_snapshot: unknown;
  sections: unknown;
  citations: unknown;
  risk_score: unknown;
  created_at: string;
}): ReportModel {
  const snap = (row.evidence_snapshot ?? {}) as { datasetName?: string; generatedAt?: string };
  const risk = (row.risk_score ?? { score: 0, level: "low", drivers: [] }) as ReportModel["risk"];
  return {
    type: row.type,
    title: row.title,
    datasetId: row.dataset_id,
    datasetName: snap.datasetName ?? "",
    generatedAt: snap.generatedAt ?? row.created_at,
    sections: (row.sections ?? []) as ReportModel["sections"],
    risk,
    citations: (row.citations ?? []) as ReportModel["citations"],
    footer:
      "Generated from Signal AI Suite evidence package. " +
      "All metrics, forecasts, anomalies, and citations are derived from " +
      "deterministic analysis outputs. AI-generated narrative sections are " +
      "grounded exclusively in cited evidence available at generation time.",
  };
}

export const exportReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found");

    const model = rowToReportModel(row);
    const bytes = await renderReportPdf(model);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "report.exported",
      metadata: { report_id: row.id, format: "pdf" },
    });
    return {
      filename: `${slugify(row.title)}.pdf`,
      contentType: "application/pdf",
      base64: bytesToBase64(bytes),
    };
  });

export const exportReportPptx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("*")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Report not found");

    const model = rowToReportModel(row);
    const bytes = await renderReportPptx(model);
    await context.supabase.from("audit_logs").insert({
      actor_id: context.userId,
      action: "report.exported",
      metadata: { report_id: row.id, format: "pptx" },
    });
    return {
      filename: `${slugify(row.title)}.pptx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      base64: bytesToBase64(bytes),
    };
  });

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "report";
}

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
import { buildEvidencePackage, hasAnyEvidence, type EvidencePackage } from "./ai/retrieval";
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
import { startTelemetry, type MinimalUsageClient } from "./observability/telemetry";
import { enforceRateLimit, RATE_LIMITS } from "./observability/rateLimit";

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
  .inputValidator((input) => z.object({ datasetId: uuid, type: reportType }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const tele = startTelemetry(supabase as unknown as MinimalUsageClient, {
      action: "report.generate",
      actorId: userId,
      resourceType: "dataset",
      resourceId: data.datasetId,
      metadata: { type: data.type },
    });
    try {
      await enforceRateLimit(supabase, userId, RATE_LIMITS.report);
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

      await tele.success({
        provider: narrated.provider,
        model: narrated.model,
        metadata: {
          report_id: row.id,
          type: data.type,
          risk_score: narrated.report.risk.score,
        },
      });

      return { report: row };
    } catch (err) {
      await tele.error(err);
      throw err;
    }
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

async function exportReport(
  context: { supabase: { from: (t: string) => unknown }; userId: string },
  reportId: string,
  format: "pdf" | "pptx",
): Promise<{
  signedUrl: string;
  path: string;
  expiresIn: number;
  filename: string;
  contentType: string;
}> {
  await enforceRateLimit(context.supabase, context.userId, RATE_LIMITS.export);

  const sb = context.supabase as unknown as {
    from: (t: string) => {
      select: (s: string) => {
        eq: (
          k: string,
          v: string,
        ) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message: string } | null;
          }>;
        };
      };
      insert: (v: Record<string, unknown>) => Promise<unknown>;
    };
  };
  const { data: row, error } = await sb
    .from("reports")
    .select("*")
    .eq("id", reportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Report not found");

  const model = rowToReportModel(row as never);
  const bytes = format === "pdf" ? await renderReportPdf(model) : await renderReportPptx(model);
  const filename = `${slugify(model.title)}.${format}`;
  const contentType =
    format === "pdf"
      ? "application/pdf"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";

  const { uploadAndSignReport } = await import("./observability/reportStorage");
  const signed = await uploadAndSignReport({
    workspaceId: (row as { workspace_id: string }).workspace_id,
    reportId: (row as { id: string }).id,
    format,
    filename,
    contentType,
    bytes,
  });

  await sb.from("audit_logs").insert({
    actor_id: context.userId,
    action: "report.exported",
    metadata: {
      report_id: (row as { id: string }).id,
      format,
      path: signed.path,
      bytes: signed.bytes,
    },
  });

  return {
    signedUrl: signed.signedUrl,
    path: signed.path,
    expiresIn: signed.expiresIn,
    filename,
    contentType,
  };
}

export const exportReportPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => exportReport(context, data.reportId, "pdf"));

export const exportReportPptx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ reportId: uuid }).parse(input))
  .handler(async ({ data, context }) => exportReport(context, data.reportId, "pptx"));

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "report"
  );
}

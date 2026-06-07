/** Background runner for `type=report` jobs.
 *
 * Mirrors the synchronous `generateReport` server function but runs under
 * the service-role client because workers execute outside any user
 * request context. Payload shape: `{ type: ReportType }`.
 */

import { buildEvidencePackage, hasAnyEvidence, type EvidencePackage } from "@/lib/ai/retrieval";
import { resolveAIProvider } from "@/lib/ai/providers";
import {
  buildReport,
  generateNarratives,
  snapshotEvidence,
  type ReportType,
} from "@/lib/reports";
import type { JobRow } from "./dispatcher.server";

type AnyClient = {
  from: (t: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
};

function toJson<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export async function runReportJob(job: JobRow, client: AnyClient): Promise<Record<string, unknown>> {
  const reportType = (job.payload?.type ?? "executive_summary") as ReportType;
  const datasetId = job.dataset_id;
  if (!datasetId) throw new Error("report job missing dataset_id");

  const { data: ds, error: dErr } = await client
    .from("datasets")
    .select("id, filename, workspace_id")
    .eq("id", datasetId)
    .maybeSingle();
  if (dErr) throw new Error(dErr.message);
  if (!ds) throw new Error("Dataset not found");

  const [profileQ, analysisQ, forecastQ, anomalyQ] = await Promise.all([
    client
      .from("dataset_profiles")
      .select("quality_score, summary_json, issues_json")
      .eq("dataset_id", ds.id)
      .maybeSingle(),
    client
      .from("analyses")
      .select(
        "id, created_at, date_column, target_column, granularity, results_json, insights_json, anomalies_json",
      )
      .eq("dataset_id", ds.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1),
    client
      .from("forecasts")
      .select(
        "id, created_at, horizon, granularity, model_name, metrics, model_comparison, assumptions, forecast_points",
      )
      .eq("dataset_id", ds.id)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(1),
    client
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
    throw new Error("No evidence available — run profile/analysis/forecast/anomaly first");
  }

  const now = new Date();
  const baseReport = buildReport({ type: reportType, pkg, now });
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

  const { data: row, error } = await client
    .from("reports")
    .insert({
      workspace_id: ds.workspace_id,
      dataset_id: datasetId,
      created_by: job.created_by,
      type: reportType,
      title: narrated.report.title,
      sections: toJson(narrated.report.sections),
      narratives: toJson(narrated.narratives),
      citations: toJson(narrated.report.citations),
      risk_score: toJson(narrated.report.risk),
      evidence_snapshot: toJson(snapshot),
      ai_model: narrated.model,
      ai_provider: narrated.provider,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return { report_id: row.id, type: reportType, risk_score: narrated.report.risk.score };
}

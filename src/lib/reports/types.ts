/** Report builder data model.
 *
 * A ReportModel is a deterministic, fully-grounded structure derived from
 * an EvidencePackage. The AI layer fills *only* the narrative slots inside
 * it — it never invents a section, KPI, table row, citation, or risk score.
 *
 * Renderers (PDF / PPTX) consume ReportModel and never call the AI. */

import type { Citation, EvidencePackage } from "../ai/retrieval";

export type ReportType =
  | "executive_summary"
  | "boardroom"
  | "risk_brief"
  | "forecast_brief"
  | "anomaly_investigation";

export interface Kpi {
  label: string;
  value: string;
  hint?: string;
}

export interface TableSection {
  type: "table";
  heading: string;
  columns: string[];
  rows: Array<Array<string>>;
}

export interface KpiSection {
  type: "kpis";
  heading: string;
  kpis: Kpi[];
}

export interface BulletSection {
  type: "bullets";
  heading: string;
  items: string[];
}

export interface NarrativeSection {
  type: "narrative";
  /** Stable slot id used to fill in the AI-generated paragraph after building. */
  slot: string;
  heading: string;
  /** Plain-language prompt for the AI when generating this narrative. */
  prompt: string;
  /** Filled by the narrative generator; never authored by deterministic code. */
  text?: string;
}

export type ReportSection = KpiSection | TableSection | BulletSection | NarrativeSection;

export interface RiskScore {
  /** 0 (low risk) .. 100 (critical). Deterministic. */
  score: number;
  level: "low" | "moderate" | "elevated" | "high" | "critical";
  drivers: string[];
}

export interface ReportModel {
  type: ReportType;
  title: string;
  datasetId: string;
  datasetName: string;
  generatedAt: string;
  sections: ReportSection[];
  risk: RiskScore;
  citations: Citation[];
  footer: string;
}

export const REPORT_FOOTER =
  "Generated from Signal AI Suite evidence package. " +
  "All metrics, forecasts, anomalies, and citations are derived from " +
  "deterministic analysis outputs. AI-generated narrative sections are " +
  "grounded exclusively in cited evidence available at generation time.";

export const REPORT_TYPE_TITLES: Record<ReportType, string> = {
  executive_summary: "Executive Summary",
  boardroom: "Boardroom Report",
  risk_brief: "Risk Brief",
  forecast_brief: "Forecast Brief",
  anomaly_investigation: "Anomaly Investigation Report",
};

/** Snapshot of which evidence sources were available at build time. */
export interface EvidenceSnapshot {
  datasetId: string;
  datasetName: string;
  generatedAt: string;
  hasProfile: boolean;
  hasAnalysis: boolean;
  hasForecast: boolean;
  hasAnomalies: boolean;
  analysisId: string | null;
  forecastId: string | null;
  anomalyRunId: string | null;
}

export function snapshotEvidence(pkg: EvidencePackage, generatedAt: string): EvidenceSnapshot {
  return {
    datasetId: pkg.datasetId,
    datasetName: pkg.datasetName,
    generatedAt,
    hasProfile: !!pkg.profile,
    hasAnalysis: !!pkg.analysis,
    hasForecast: !!pkg.forecast,
    hasAnomalies: !!pkg.anomalies,
    analysisId: pkg.analysis?.id ?? null,
    forecastId: pkg.forecast?.id ?? null,
    anomalyRunId: pkg.anomalies?.id ?? null,
  };
}

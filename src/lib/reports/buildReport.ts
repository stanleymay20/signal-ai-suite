/** Deterministic builders: EvidencePackage → ReportModel.
 *
 * The AI layer is invoked separately, only to fill `narrative.text` slots.
 * These builders never call a model. */

import { deriveCitations, type EvidencePackage } from "../ai/retrieval";
import { fmtInt, fmtNum, fmtPct, titleCase } from "./format";
import { computeRiskScore } from "./riskScoring";
import {
  REPORT_FOOTER,
  REPORT_TYPE_TITLES,
  type KpiSection,
  type ReportModel,
  type ReportSection,
  type ReportType,
  type TableSection,
} from "./types";

function profileKpis(pkg: EvidencePackage): KpiSection | null {
  if (!pkg.profile) return null;
  return {
    type: "kpis",
    heading: "Dataset Profile",
    kpis: [
      { label: "Rows", value: fmtInt(pkg.profile.rowCount) },
      { label: "Columns", value: fmtInt(pkg.profile.columnCount) },
      {
        label: "Quality",
        value: `${pkg.profile.qualityScore}/100`,
        hint: "Profiling score",
      },
      {
        label: "Missing cells",
        value: fmtPct(pkg.profile.missingPct),
      },
    ],
  };
}

function forecastKpis(pkg: EvidencePackage): KpiSection | null {
  if (!pkg.forecast) return null;
  return {
    type: "kpis",
    heading: "Forecast Performance",
    kpis: [
      { label: "Best model", value: titleCase(pkg.forecast.bestModel) },
      { label: "Horizon", value: `${pkg.forecast.horizon}` },
      { label: "RMSE", value: fmtNum(pkg.forecast.metrics.rmse) },
      { label: "MAPE", value: fmtPct(pkg.forecast.metrics.mape) },
    ],
  };
}

function anomalyKpis(pkg: EvidencePackage): KpiSection | null {
  if (!pkg.anomalies) return null;
  const c = pkg.anomalies.bySeverity ?? {};
  return {
    type: "kpis",
    heading: "Anomaly Summary",
    kpis: [
      { label: "Total flagged", value: fmtInt(pkg.anomalies.total) },
      { label: "Critical", value: fmtInt(c.critical ?? 0) },
      { label: "High", value: fmtInt(c.high ?? 0) },
      { label: "Medium", value: fmtInt(c.medium ?? 0) },
    ],
  };
}

function anomalyTable(pkg: EvidencePackage): TableSection | null {
  if (!pkg.anomalies || pkg.anomalies.top.length === 0) return null;
  return {
    type: "table",
    heading: "Top Anomalies",
    columns: ["Timestamp", "Observed", "Expected", "Severity", "Method"],
    rows: pkg.anomalies.top.map((a) => [
      a.t,
      fmtNum(a.value),
      fmtNum(a.expected ?? null),
      a.severity,
      a.method,
    ]),
  };
}

function modelComparisonTable(pkg: EvidencePackage): TableSection | null {
  if (!pkg.forecast || pkg.forecast.models.length === 0) return null;
  return {
    type: "table",
    heading: "Model Comparison",
    columns: ["Model", "RMSE", "MAE", "MAPE"],
    rows: pkg.forecast.models.map((m) => [
      titleCase(m.name),
      fmtNum(m.rmse),
      fmtNum(m.mae),
      fmtPct(m.mape),
    ]),
  };
}

function assumptions(pkg: EvidencePackage): ReportSection | null {
  if (!pkg.forecast || !pkg.forecast.assumptions || pkg.forecast.assumptions.length === 0) {
    return null;
  }
  return {
    type: "bullets",
    heading: "Forecast Assumptions",
    items: pkg.forecast.assumptions,
  };
}

function insightsList(pkg: EvidencePackage): ReportSection | null {
  if (!pkg.analysis || !pkg.analysis.insights || pkg.analysis.insights.length === 0) return null;
  return {
    type: "bullets",
    heading: "Analysis Insights",
    items: pkg.analysis.insights,
  };
}

function riskDrivers(pkg: EvidencePackage): ReportSection {
  const risk = computeRiskScore(pkg);
  return {
    type: "bullets",
    heading: `Risk Drivers (score ${risk.score}/100 · ${risk.level})`,
    items: risk.drivers.length > 0 ? risk.drivers : ["No material risk drivers detected."],
  };
}

function narrative(slot: string, heading: string, prompt: string): ReportSection {
  return { type: "narrative", slot, heading, prompt };
}

// ---------- Per-type builders ----------

function buildExecutiveSummary(pkg: EvidencePackage): ReportSection[] {
  const out: ReportSection[] = [];
  const p = profileKpis(pkg);
  if (p) out.push(p);
  const f = forecastKpis(pkg);
  if (f) out.push(f);
  const a = anomalyKpis(pkg);
  if (a) out.push(a);
  out.push(
    narrative(
      "executive_summary",
      "Executive Summary",
      "Summarize the dataset's current state, forecast quality, and anomaly load for a non-technical executive in 3–4 sentences. Reference only metrics already shown in the report above.",
    ),
  );
  out.push(riskDrivers(pkg));
  out.push(
    narrative(
      "recommendations",
      "Recommendations",
      "Recommend up to three concrete next actions, each justified by an evidence source already cited (profile / analysis / forecast / anomalies). Do not invent new metrics.",
    ),
  );
  return out;
}

function buildBoardroom(pkg: EvidencePackage): ReportSection[] {
  const out: ReportSection[] = [];
  out.push(
    narrative(
      "boardroom_headline",
      "Headline",
      "Open with one sentence describing the most material finding from the evidence. No new numbers.",
    ),
  );
  const p = profileKpis(pkg);
  if (p) out.push(p);
  const f = forecastKpis(pkg);
  if (f) out.push(f);
  const a = anomalyKpis(pkg);
  if (a) out.push(a);
  out.push(
    narrative(
      "boardroom_commentary",
      "Boardroom Commentary",
      "Provide a 4–6 sentence boardroom-style commentary that ties together quality, forecast performance, and anomaly load. Stay strictly grounded in the cited evidence.",
    ),
  );
  const t = anomalyTable(pkg);
  if (t) out.push(t);
  out.push(riskDrivers(pkg));
  out.push(
    narrative(
      "boardroom_decisions",
      "Decisions Requested",
      "List up to three decisions the board should make next, each tied to a specific evidence source.",
    ),
  );
  return out;
}

function buildRiskBrief(pkg: EvidencePackage): ReportSection[] {
  const out: ReportSection[] = [];
  out.push(riskDrivers(pkg));
  const p = profileKpis(pkg);
  if (p) out.push(p);
  const a = anomalyKpis(pkg);
  if (a) out.push(a);
  const at = anomalyTable(pkg);
  if (at) out.push(at);
  out.push(
    narrative(
      "risk_interpretation",
      "Risk Interpretation",
      "Explain what the deterministic risk score and its drivers mean in plain English. Do not invent new drivers; explain only those listed above.",
    ),
  );
  out.push(
    narrative(
      "risk_mitigations",
      "Suggested Mitigations",
      "Suggest concrete mitigations for the listed risk drivers, citing the relevant evidence source for each.",
    ),
  );
  return out;
}

function buildForecastBrief(pkg: EvidencePackage): ReportSection[] {
  const out: ReportSection[] = [];
  const f = forecastKpis(pkg);
  if (f) out.push(f);
  const mc = modelComparisonTable(pkg);
  if (mc) out.push(mc);
  const asm = assumptions(pkg);
  if (asm) out.push(asm);
  out.push(
    narrative(
      "forecast_interpretation",
      "Forecast Interpretation",
      "Explain the best model's performance and the trade-offs versus the alternatives shown in the comparison table. Use only the metrics already shown.",
    ),
  );
  out.push(
    narrative(
      "forecast_caveats",
      "Caveats",
      "Restate the persisted forecast assumptions as plain-English caveats. Add no new assumptions.",
    ),
  );
  return out;
}

function buildAnomalyInvestigation(pkg: EvidencePackage): ReportSection[] {
  const out: ReportSection[] = [];
  const ak = anomalyKpis(pkg);
  if (ak) out.push(ak);
  const at = anomalyTable(pkg);
  if (at) out.push(at);
  const insights = insightsList(pkg);
  if (insights) out.push(insights);
  out.push(
    narrative(
      "anomaly_interpretation",
      "Anomaly Interpretation",
      "Interpret the anomaly summary and the top anomalies shown above in plain English. Do not invent additional anomalies.",
    ),
  );
  out.push(riskDrivers(pkg));
  out.push(
    narrative(
      "anomaly_actions",
      "Investigation Actions",
      "Recommend investigation steps for the top anomalies. Cite the anomaly run id and timestamps from the evidence.",
    ),
  );
  return out;
}

const BUILDERS: Record<ReportType, (pkg: EvidencePackage) => ReportSection[]> = {
  executive_summary: buildExecutiveSummary,
  boardroom: buildBoardroom,
  risk_brief: buildRiskBrief,
  forecast_brief: buildForecastBrief,
  anomaly_investigation: buildAnomalyInvestigation,
};

export interface BuildReportInput {
  type: ReportType;
  pkg: EvidencePackage;
  /** Defaults to current time. Injected for deterministic testing. */
  now?: Date;
}

/** Deterministic: identical inputs always produce identical sections,
 * citations, and risk score. Narrative `text` slots are intentionally empty
 * here and are filled later by the narrative generator. */
export function buildReport(input: BuildReportInput): ReportModel {
  const now = input.now ?? new Date();
  const sections = BUILDERS[input.type](input.pkg);
  const risk = computeRiskScore(input.pkg);
  const citations = deriveCitations(input.pkg);
  const baseTitle = REPORT_TYPE_TITLES[input.type];
  return {
    type: input.type,
    title: `${baseTitle} — ${input.pkg.datasetName}`,
    datasetId: input.pkg.datasetId,
    datasetName: input.pkg.datasetName,
    generatedAt: now.toISOString(),
    sections,
    risk,
    citations,
    footer: REPORT_FOOTER,
  };
}

/** Slot ids present in a built report (used by the narrative generator). */
export function narrativeSlots(
  report: ReportModel,
): Array<{ slot: string; heading: string; prompt: string }> {
  return report.sections
    .filter((s): s is Extract<ReportSection, { type: "narrative" }> => s.type === "narrative")
    .map((s) => ({ slot: s.slot, heading: s.heading, prompt: s.prompt }));
}

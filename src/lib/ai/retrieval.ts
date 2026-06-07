/** Evidence retrieval & packaging.
 *
 * The conversational layer MUST only see what the analysis engine has already
 * proven. This module is pure: given raw DB rows (or nulls), it shapes a
 * compact, deterministic evidence package and computes the citations that
 * back any answer derived from it. */

export interface EvidenceProfile {
  rowCount: number;
  columnCount: number;
  missingPct: number;
  duplicatePct: number;
  qualityScore: number;
  numericColumns: number;
  dateColumns: number;
  categoricalColumns: number;
  topIssues: Array<{ code: string; severity: string; message: string }>;
}

export interface EvidenceAnalysis {
  id: string;
  computedAt: string;
  dateColumn: string | null;
  targetColumn: string | null;
  granularity: string | null;
  trend?: { direction: string; slope?: number; r2?: number } | null;
  seasonality?: { detected: boolean; period?: number | null } | null;
  correlationsTop?: Array<{ a: string; b: string; r: number }>;
  insights?: string[];
  baselineAnomalies?: number;
}

export interface EvidenceForecastModel {
  name: string;
  rmse?: number | null;
  mae?: number | null;
  mape?: number | null;
}

export interface EvidenceForecast {
  id: string;
  computedAt: string;
  horizon: number;
  granularity: string | null;
  bestModel: string;
  metrics: { rmse?: number | null; mae?: number | null; mape?: number | null };
  models: EvidenceForecastModel[];
  assumptions?: string[];
  pointCount: number;
}

export interface EvidenceAnomaly {
  t: string;
  value: number;
  expected?: number | null;
  severity: string;
  method: string;
  score?: number | null;
}

export interface EvidenceAnomalyRun {
  id: string;
  computedAt: string;
  methods: string[];
  total: number;
  bySeverity: Record<string, number>;
  top: EvidenceAnomaly[];
}

export interface EvidencePackage {
  datasetId: string;
  datasetName: string;
  profile: EvidenceProfile | null;
  analysis: EvidenceAnalysis | null;
  forecast: EvidenceForecast | null;
  anomalies: EvidenceAnomalyRun | null;
}

export type CitationSource = "profile" | "analysis" | "forecast" | "anomaly";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [k: string]: JsonValue }
  | JsonValue[];

export interface Citation {
  source: CitationSource;
  ref: string;
  detail?: { [k: string]: JsonValue };
}

// ---------- Builders ----------

type ProfileRow = {
  quality_score: number;
  summary_json: unknown;
  issues_json: unknown;
} | null;

type AnalysisRow = {
  id: string;
  created_at: string;
  date_column: string | null;
  target_column: string | null;
  granularity: string | null;
  results_json: unknown;
  insights_json: unknown;
  anomalies_json: unknown;
} | null;

type ForecastRow = {
  id: string;
  created_at: string;
  horizon: number;
  granularity: string | null;
  model_name: string;
  metrics: unknown;
  model_comparison: unknown;
  assumptions: unknown;
  forecast_points: unknown;
} | null;

type AnomalyRunRow = {
  id: string;
  created_at: string;
  methods: string[] | null;
  summary: unknown;
  anomalies: unknown;
} | null;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function buildProfileEvidence(row: ProfileRow): EvidenceProfile | null {
  if (!row) return null;
  const s = asRecord(row.summary_json);
  const issues = asArray<Record<string, unknown>>(row.issues_json);
  return {
    rowCount: Number(s.rowCount ?? 0),
    columnCount: Number(s.columnCount ?? 0),
    missingPct: Number(s.missingCellPercentage ?? 0),
    duplicatePct: Number(s.duplicateRowPercentage ?? 0),
    qualityScore: row.quality_score,
    numericColumns: Number(s.numericColumns ?? 0),
    dateColumns: Number(s.dateColumns ?? 0),
    categoricalColumns: Number(s.categoricalColumns ?? 0),
    topIssues: issues.slice(0, 5).map((i) => ({
      code: String(i.code ?? "unknown"),
      severity: String(i.severity ?? "info"),
      message: String(i.message ?? ""),
    })),
  };
}

export function buildAnalysisEvidence(row: AnalysisRow): EvidenceAnalysis | null {
  if (!row) return null;
  const r = asRecord(row.results_json);
  const trend = asRecord(r.trend);
  const seasonality = asRecord(r.seasonality);
  const correlation = asRecord(r.correlation);
  const corrPairs = asArray<Record<string, unknown>>(correlation.topPairs);
  const insights = asArray<unknown>(row.insights_json)
    .map((i) => (typeof i === "string" ? i : str(asRecord(i).message)))
    .filter((s): s is string => !!s)
    .slice(0, 8);

  return {
    id: row.id,
    computedAt: row.created_at,
    dateColumn: row.date_column,
    targetColumn: row.target_column,
    granularity: row.granularity,
    trend: trend.direction
      ? { direction: String(trend.direction), slope: num(trend.slope), r2: num(trend.r2) }
      : null,
    seasonality: {
      detected: Boolean(seasonality.detected),
      period: num(seasonality.period) ?? null,
    },
    correlationsTop: corrPairs.slice(0, 5).map((p) => ({
      a: String(p.a ?? ""),
      b: String(p.b ?? ""),
      r: Number(p.r ?? 0),
    })),
    insights,
    baselineAnomalies: asArray(row.anomalies_json).length,
  };
}

export function buildForecastEvidence(row: ForecastRow): EvidenceForecast | null {
  if (!row) return null;
  const metrics = asRecord(row.metrics);
  const comparison = asArray<Record<string, unknown>>(row.model_comparison);
  const assumptions = asArray<unknown>(row.assumptions)
    .map((a) => (typeof a === "string" ? a : str(asRecord(a).message)))
    .filter((s): s is string => !!s);
  return {
    id: row.id,
    computedAt: row.created_at,
    horizon: row.horizon,
    granularity: row.granularity,
    bestModel: row.model_name,
    metrics: { rmse: num(metrics.rmse), mae: num(metrics.mae), mape: num(metrics.mape) },
    models: comparison.map((m) => {
      const mm = asRecord(m.metrics);
      return {
        name: String(m.name ?? m.model ?? ""),
        rmse: num(mm.rmse),
        mae: num(mm.mae),
        mape: num(mm.mape),
      };
    }),
    assumptions,
    pointCount: asArray(row.forecast_points).length,
  };
}

export function buildAnomalyEvidence(row: AnomalyRunRow): EvidenceAnomalyRun | null {
  if (!row) return null;
  const summary = asRecord(row.summary);
  const list = asArray<Record<string, unknown>>(row.anomalies);
  const bySeverity: Record<string, number> = {};
  for (const a of list) {
    const sev = String(a.severity ?? "unknown");
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1;
  }
  // Top by absolute score, fallback to severity order.
  const sevRank: Record<string, number> = { critical: 3, high: 2, medium: 1, low: 0 };
  const top = [...list]
    .sort((a, b) => {
      const sa = num(a.score) ?? sevRank[String(a.severity)] ?? 0;
      const sb = num(b.score) ?? sevRank[String(b.severity)] ?? 0;
      return Math.abs(sb) - Math.abs(sa);
    })
    .slice(0, 5)
    .map<EvidenceAnomaly>((a) => ({
      t: String(a.t ?? a.timestamp ?? ""),
      value: Number(a.value ?? 0),
      expected: num(a.expected) ?? null,
      severity: String(a.severity ?? "unknown"),
      method: String(a.method ?? "unknown"),
      score: num(a.score) ?? null,
    }));

  return {
    id: row.id,
    computedAt: row.created_at,
    methods: row.methods ?? [],
    total: Number(summary.total ?? list.length),
    bySeverity,
    top,
  };
}

export interface RawEvidenceInputs {
  datasetId: string;
  datasetName: string;
  profile: ProfileRow;
  analysis: AnalysisRow;
  forecast: ForecastRow;
  anomalyRun: AnomalyRunRow;
}

export function buildEvidencePackage(input: RawEvidenceInputs): EvidencePackage {
  return {
    datasetId: input.datasetId,
    datasetName: input.datasetName,
    profile: buildProfileEvidence(input.profile),
    analysis: buildAnalysisEvidence(input.analysis),
    forecast: buildForecastEvidence(input.forecast),
    anomalies: buildAnomalyEvidence(input.anomalyRun),
  };
}

// ---------- Citations ----------

/** Deterministic citations derived from the evidence package. The AI cannot
 * invent a citation that isn't in this list because the list is computed
 * before the AI is called, from the same data the AI sees. */
export function deriveCitations(pkg: EvidencePackage): Citation[] {
  const out: Citation[] = [];

  if (pkg.profile) {
    out.push({
      source: "profile",
      ref: "dataset_profile",
      detail: {
        rowCount: pkg.profile.rowCount,
        qualityScore: pkg.profile.qualityScore,
        missingPct: pkg.profile.missingPct,
      },
    });
  }

  if (pkg.analysis) {
    out.push({
      source: "analysis",
      ref: pkg.analysis.id,
      detail: {
        trend: pkg.analysis.trend?.direction ?? "unknown",
        seasonalityDetected: pkg.analysis.seasonality?.detected ?? false,
        target: pkg.analysis.targetColumn,
      },
    });
  }

  if (pkg.forecast) {
    out.push({
      source: "forecast",
      ref: pkg.forecast.id,
      detail: {
        model: pkg.forecast.bestModel,
        rmse: pkg.forecast.metrics.rmse ?? null,
        mae: pkg.forecast.metrics.mae ?? null,
        mape: pkg.forecast.metrics.mape ?? null,
        horizon: pkg.forecast.horizon,
      },
    });
  }

  if (pkg.anomalies) {
    out.push({
      source: "anomaly",
      ref: pkg.anomalies.id,
      detail: {
        total: pkg.anomalies.total,
        bySeverity: pkg.anomalies.bySeverity,
        methods: pkg.anomalies.methods,
      },
    });
    for (const a of pkg.anomalies.top.slice(0, 3)) {
      out.push({
        source: "anomaly",
        ref: `${pkg.anomalies.id}:${a.t}`,
        detail: {
          timestamp: a.t,
          value: a.value,
          expected: a.expected,
          severity: a.severity,
          method: a.method,
        },
      });
    }
  }

  return out;
}

/** True when the package contains enough grounded evidence to answer at all. */
export function hasAnyEvidence(pkg: EvidencePackage): boolean {
  return !!(pkg.profile || pkg.analysis || pkg.forecast || pkg.anomalies);
}

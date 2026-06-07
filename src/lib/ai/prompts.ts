import type { EvidencePackage } from "./retrieval";

export const SYSTEM_PROMPT = `You are SignalGPT, a conversational analytics
assistant. You explain evidence; you do NOT invent it.

Rules:
- Use ONLY the EVIDENCE block below. Do not introduce numbers, dates,
  columns, models, or anomalies that are not in the evidence.
- If the evidence does not support an answer, say so plainly and suggest
  which analysis the user should run next (profile, analysis, forecast,
  anomaly detection).
- Never assert causation. Prefer "associated with", "coincides with",
  "correlated with".
- Keep answers concise and structured. Use short bullet lists when listing
  metrics, anomalies, or recommendations.
- When you cite a number, name the evidence source it came from
  (profile / analysis / forecast / anomaly).

Supported question types: dataset summary, trend explanation, forecast
explanation, anomaly explanation, risk identification, recommended next
investigation.`;

/** Compact, deterministic evidence rendering. Keep this stable — tests
 * inspect the rendered structure. */
export function renderEvidence(pkg: EvidencePackage): string {
  const lines: string[] = [];
  lines.push(`DATASET: ${pkg.datasetName} (id=${pkg.datasetId})`);

  if (pkg.profile) {
    const p = pkg.profile;
    lines.push("");
    lines.push("PROFILE:");
    lines.push(
      `- rows=${p.rowCount}, cols=${p.columnCount}, quality_score=${p.qualityScore}/100`,
    );
    lines.push(`- missing=${p.missingPct}%, duplicates=${p.duplicatePct}%`);
    lines.push(
      `- numeric=${p.numericColumns}, date=${p.dateColumns}, categorical=${p.categoricalColumns}`,
    );
    if (p.topIssues.length) {
      lines.push("- top issues:");
      for (const i of p.topIssues) lines.push(`  · [${i.severity}] ${i.code}: ${i.message}`);
    }
  }

  if (pkg.analysis) {
    const a = pkg.analysis;
    lines.push("");
    lines.push(`ANALYSIS (id=${a.id}, computed=${a.computedAt}):`);
    lines.push(`- target=${a.targetColumn}, date=${a.dateColumn}, granularity=${a.granularity}`);
    if (a.trend)
      lines.push(
        `- trend: ${a.trend.direction}` +
          (a.trend.slope !== undefined ? `, slope=${a.trend.slope.toFixed(4)}` : "") +
          (a.trend.r2 !== undefined ? `, r²=${a.trend.r2.toFixed(3)}` : ""),
      );
    if (a.seasonality)
      lines.push(
        `- seasonality: ${a.seasonality.detected ? `detected (period=${a.seasonality.period ?? "?"})` : "none detected"}`,
      );
    if (a.correlationsTop?.length) {
      lines.push("- top correlations:");
      for (const c of a.correlationsTop) lines.push(`  · ${c.a} ↔ ${c.b} r=${c.r.toFixed(3)}`);
    }
    if (a.insights?.length) {
      lines.push("- insights:");
      for (const i of a.insights) lines.push(`  · ${i}`);
    }
    lines.push(`- baseline anomaly candidates: ${a.baselineAnomalies ?? 0}`);
  }

  if (pkg.forecast) {
    const f = pkg.forecast;
    lines.push("");
    lines.push(`FORECAST (id=${f.id}, computed=${f.computedAt}):`);
    lines.push(`- best model: ${f.bestModel}, horizon=${f.horizon}, granularity=${f.granularity}`);
    const m = f.metrics;
    lines.push(
      `- metrics: rmse=${m.rmse ?? "n/a"}, mae=${m.mae ?? "n/a"}, mape=${m.mape ?? "n/a"}`,
    );
    if (f.models.length) {
      lines.push("- model comparison:");
      for (const mm of f.models)
        lines.push(
          `  · ${mm.name}: rmse=${mm.rmse ?? "n/a"}, mae=${mm.mae ?? "n/a"}, mape=${mm.mape ?? "n/a"}`,
        );
    }
    if (f.assumptions?.length) {
      lines.push("- assumptions:");
      for (const a of f.assumptions) lines.push(`  · ${a}`);
    }
    lines.push(`- forecast points: ${f.pointCount}`);
  }

  if (pkg.anomalies) {
    const x = pkg.anomalies;
    lines.push("");
    lines.push(`ANOMALIES (id=${x.id}, computed=${x.computedAt}):`);
    lines.push(`- methods: ${x.methods.join(", ") || "n/a"}`);
    lines.push(
      `- total=${x.total}, by_severity=${Object.entries(x.bySeverity)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ")}`,
    );
    if (x.top.length) {
      lines.push("- top anomalies:");
      for (const a of x.top)
        lines.push(
          `  · ${a.t} value=${a.value}` +
            (a.expected !== null ? ` expected=${a.expected}` : "") +
            ` severity=${a.severity} method=${a.method}` +
            (a.score !== null ? ` score=${a.score}` : ""),
        );
    }
  }

  if (lines.length === 1) lines.push("(no evidence available yet)");
  return lines.join("\n");
}

export function buildSystemMessage(pkg: EvidencePackage): string {
  return `${SYSTEM_PROMPT}\n\nEVIDENCE:\n${renderEvidence(pkg)}`;
}

/** Heuristic follow-up suggestions based on what evidence is missing. */
export function suggestFollowups(pkg: EvidencePackage): string[] {
  const out: string[] = [];
  if (pkg.analysis) out.push("What trends and seasonality stand out?");
  if (pkg.forecast) out.push("Which forecast model performed best and why?");
  if (pkg.anomalies && pkg.anomalies.total > 0)
    out.push("Explain the most severe anomaly.");
  if (pkg.profile) out.push("Summarize the dataset's quality and biggest risks.");
  if (!pkg.analysis) out.push("Run an analysis to unlock trend explanations.");
  if (!pkg.forecast) out.push("Run a forecast to compare models.");
  if (!pkg.anomalies) out.push("Run anomaly detection for outlier insights.");
  return out.slice(0, 4);
}

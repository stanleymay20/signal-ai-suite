import type { ColumnProfile, DataIssue } from "./types";

interface Input {
  missingCellPercentage: number;
  duplicateRowPercentage: number;
  columns: ColumnProfile[];
  issues: DataIssue[];
}

/**
 * Health score 0–100. Deterministic, based on:
 * - missing cells (up to -40)
 * - duplicate rows (up to -25)
 * - invalid/unknown columns (up to -15)
 * - constant / fully-unique non-id columns (up to -10)
 * - critical issues (-15 each, capped at -30)
 */
export function calculateHealthScore(d: Input): number {
  let score = 100;

  score -= Math.min(40, d.missingCellPercentage * 1.0);
  score -= Math.min(25, d.duplicateRowPercentage * 2.0);

  if (d.columns.length > 0) {
    const unknownPct = d.columns.filter((c) => c.dataType === "unknown").length / d.columns.length;
    score -= Math.min(15, unknownPct * 100 * 0.3);

    const constantPct =
      d.columns.filter((c) => c.stats.count > 0 && c.uniqueRatio === 0).length / d.columns.length;
    score -= Math.min(10, constantPct * 100 * 0.2);
  }

  const critical = d.issues.filter((i) => i.severity === "critical").length;
  score -= Math.min(30, critical * 15);

  return Math.max(0, Math.min(100, Math.round(score)));
}

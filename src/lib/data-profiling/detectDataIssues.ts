import type { ColumnProfile, DataIssue } from "./types";

interface Input {
  rowCount: number;
  columnCount: number;
  duplicateRowPercentage: number;
  missingCellPercentage: number;
  columns: ColumnProfile[];
}

export function detectDataIssues(d: Input): DataIssue[] {
  const issues: DataIssue[] = [];

  if (d.rowCount === 0) {
    issues.push({ severity: "critical", code: "empty_dataset", message: "Dataset has no rows." });
  }
  if (d.columnCount === 0) {
    issues.push({ severity: "critical", code: "no_columns", message: "Dataset has no columns." });
  }
  if (d.missingCellPercentage >= 30) {
    issues.push({
      severity: "warning", code: "high_missing_cells",
      message: `High overall missing cells: ${d.missingCellPercentage}%.`,
    });
  }
  if (d.duplicateRowPercentage >= 5) {
    issues.push({
      severity: "warning", code: "duplicate_rows",
      message: `${d.duplicateRowPercentage}% of rows are duplicates.`,
    });
  }

  for (const c of d.columns) {
    if (c.missingPercentage >= 50) {
      issues.push({
        severity: "warning", code: "column_high_missing", column: c.name,
        message: `Column "${c.name}" is ${c.missingPercentage}% missing.`,
      });
    }
    if (c.stats.count > 0 && c.uniqueRatio === 1 && c.dataType !== "unknown") {
      issues.push({
        severity: "info", code: "column_all_unique", column: c.name,
        message: `Column "${c.name}" has all unique values (possible identifier).`,
      });
    }
    if (c.stats.count > 0 && c.uniqueRatio === 0) {
      issues.push({
        severity: "warning", code: "column_constant", column: c.name,
        message: `Column "${c.name}" has only one value.`,
      });
    }
    if (c.dataType === "unknown" && c.stats.count > 0) {
      issues.push({
        severity: "info", code: "column_type_unknown", column: c.name,
        message: `Column "${c.name}" type could not be inferred.`,
      });
    }
  }

  return issues;
}

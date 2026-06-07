import { inferColumnType, isMissing } from "./inferColumnTypes";
import { calculateHealthScore } from "./calculateHealthScore";
import { detectDataIssues } from "./detectDataIssues";
import type { ColumnProfile, ColumnStats, DatasetProfile, RawRow } from "./types";

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function rowSignature(row: RawRow, columns: string[]): string {
  return columns.map((c) => String(row[c] ?? "")).join("\u0001");
}

export function profileDataset(rows: RawRow[], columns: string[]): DatasetProfile {
  const rowCount = rows.length;
  const columnCount = columns.length;

  const colProfiles: ColumnProfile[] = columns.map((name, position) => {
    const values = rows.map((r) => r[name]);
    let missing = 0;
    const valueCounts = new Map<string, number>();
    for (const v of values) {
      if (isMissing(v)) { missing++; continue; }
      const key = String(v);
      valueCounts.set(key, (valueCounts.get(key) ?? 0) + 1);
    }
    const nonMissing = rowCount - missing;
    const unique = valueCounts.size;
    const uniqueRatio = nonMissing > 0 ? unique / nonMissing : 0;
    const dataType = inferColumnType(values, uniqueRatio);

    const stats: ColumnStats = {
      count: nonMissing,
      missing,
      unique,
    };

    if (dataType === "numeric" || dataType === "integer") {
      const nums: number[] = [];
      for (const v of values) {
        const n = toNumber(v);
        if (n !== null) nums.push(n);
      }
      if (nums.length) {
        const sum = nums.reduce((a, b) => a + b, 0);
        const mean = sum / nums.length;
        const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length;
        stats.min = Math.min(...nums);
        stats.max = Math.max(...nums);
        stats.mean = mean;
        stats.stddev = Math.sqrt(variance);
      }
    } else if (dataType === "date" || dataType === "datetime") {
      let min = Infinity, max = -Infinity;
      for (const v of values) {
        if (isMissing(v)) continue;
        const t = v instanceof Date ? v.getTime() : Date.parse(String(v));
        if (Number.isFinite(t)) { if (t < min) min = t; if (t > max) max = t; }
      }
      if (Number.isFinite(min)) stats.min = new Date(min).toISOString();
      if (Number.isFinite(max)) stats.max = new Date(max).toISOString();
    } else {
      const top = [...valueCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([value, count]) => ({ value, count }));
      stats.topValues = top;
    }

    stats.examples = values
      .filter((v) => !isMissing(v))
      .slice(0, 3)
      .map((v) => String(v));

    return {
      name,
      position,
      dataType,
      nullable: missing > 0,
      uniqueRatio: Number(uniqueRatio.toFixed(5)),
      missingPercentage: rowCount > 0 ? Number(((missing / rowCount) * 100).toFixed(3)) : 0,
      stats,
    };
  });

  // duplicate rows
  const sigs = new Map<string, number>();
  for (const r of rows) {
    const s = rowSignature(r, columns);
    sigs.set(s, (sigs.get(s) ?? 0) + 1);
  }
  let duplicateRows = 0;
  for (const c of sigs.values()) if (c > 1) duplicateRows += c - 1;
  const duplicateRowPercentage = rowCount > 0
    ? Number(((duplicateRows / rowCount) * 100).toFixed(3))
    : 0;

  const totalCells = rowCount * columnCount;
  const missingCells = colProfiles.reduce((a, c) => a + c.stats.missing, 0);
  const missingCellPercentage = totalCells > 0
    ? Number(((missingCells / totalCells) * 100).toFixed(3))
    : 0;

  const numericColumns = colProfiles.filter((c) => c.dataType === "numeric" || c.dataType === "integer").length;
  const categoricalColumns = colProfiles.filter((c) => c.dataType === "categorical" || c.dataType === "boolean").length;
  const dateColumns = colProfiles.filter((c) => c.dataType === "date" || c.dataType === "datetime").length;

  const issues = detectDataIssues({
    rowCount, columnCount, duplicateRowPercentage, missingCellPercentage, columns: colProfiles,
  });
  const qualityScore = calculateHealthScore({
    missingCellPercentage, duplicateRowPercentage, columns: colProfiles, issues,
  });

  return {
    rowCount, columnCount, duplicateRowPercentage, missingCellPercentage,
    numericColumns, categoricalColumns, dateColumns,
    columns: colProfiles, issues, qualityScore,
  };
}

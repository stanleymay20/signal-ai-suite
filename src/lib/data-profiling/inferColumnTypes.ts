import type { ColumnDataType } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?/;
const SLASH_DATE = /^\d{1,4}[/\-.]\d{1,2}[/\-.]\d{1,4}$/;
const INTEGER_RE = /^-?\d+$/;
const NUMERIC_RE = /^-?\d*\.?\d+(e[-+]?\d+)?$/i;

export function isMissing(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") {
    const t = v.trim().toLowerCase();
    return t === "" || t === "na" || t === "n/a" || t === "null" || t === "nan";
  }
  return false;
}

function classify(v: string): ColumnDataType {
  const s = v.trim();
  if (s === "true" || s === "false") return "boolean";
  if (INTEGER_RE.test(s)) return "integer";
  if (NUMERIC_RE.test(s)) return "numeric";
  if (ISO_DATETIME.test(s)) return "datetime";
  if (ISO_DATE.test(s) || SLASH_DATE.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return "date";
  }
  return "string";
}

/** Aggregate type from sampled non-missing values. */
export function inferColumnType(values: unknown[], uniqueRatio: number): ColumnDataType {
  const counts: Record<ColumnDataType, number> = {
    numeric: 0,
    integer: 0,
    boolean: 0,
    date: 0,
    datetime: 0,
    string: 0,
    categorical: 0,
    unknown: 0,
  };
  let total = 0;
  for (const raw of values) {
    if (isMissing(raw)) continue;
    total++;
    if (typeof raw === "number") {
      counts[Number.isInteger(raw) ? "integer" : "numeric"]++;
      continue;
    }
    if (typeof raw === "boolean") {
      counts.boolean++;
      continue;
    }
    if (raw instanceof Date) {
      counts.datetime++;
      continue;
    }
    counts[classify(String(raw))]++;
  }
  if (total === 0) return "unknown";

  const pct = (k: ColumnDataType) => counts[k] / total;
  if (pct("boolean") >= 0.95) return "boolean";
  if (pct("integer") + pct("numeric") >= 0.95) {
    return pct("numeric") > 0 ? "numeric" : "integer";
  }
  if (pct("datetime") >= 0.9) return "datetime";
  if (pct("date") + pct("datetime") >= 0.9) return "date";
  if (uniqueRatio <= 0.1 && total >= 20) return "categorical";
  return "string";
}

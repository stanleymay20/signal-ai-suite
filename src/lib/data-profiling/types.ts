export type ColumnDataType =
  | "numeric"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "string"
  | "categorical"
  | "unknown";

export interface ColumnStats {
  count: number;
  missing: number;
  unique: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  stddev?: number;
  topValues?: Array<{ value: string; count: number }>;
  examples?: string[];
}

export interface ColumnProfile {
  name: string;
  position: number;
  dataType: ColumnDataType;
  nullable: boolean;
  uniqueRatio: number;
  missingPercentage: number;
  stats: ColumnStats;
}

export interface DataIssue {
  severity: "info" | "warning" | "critical";
  code: string;
  message: string;
  column?: string;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  duplicateRowPercentage: number;
  missingCellPercentage: number;
  numericColumns: number;
  categoricalColumns: number;
  dateColumns: number;
  columns: ColumnProfile[];
  issues: DataIssue[];
  qualityScore: number;
}

export type RawRow = Record<string, unknown>;

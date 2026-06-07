import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { RawRow } from "./types";

export interface ParsedFile {
  columns: string[];
  rows: RawRow[];
}

const MAX_ROWS = 100_000;

export function parseCsv(text: string): ParsedFile {
  const res = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
  });
  const rows = (res.data ?? []).slice(0, MAX_ROWS);
  const columns = res.meta?.fields?.map((f) => f.trim()) ?? (rows[0] ? Object.keys(rows[0]) : []);
  return { columns, rows };
}

export function parseXlsx(buffer: ArrayBuffer): ParsedFile {
  const wb = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { columns: [], rows: [] };
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null, raw: true });
  const rows = json.slice(0, MAX_ROWS);
  const columns = rows[0] ? Object.keys(rows[0]) : [];
  return { columns, rows };
}

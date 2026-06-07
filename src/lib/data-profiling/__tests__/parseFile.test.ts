import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseCsv, parseXlsx } from "../parseFile";

describe("parseCsv", () => {
  it("parses headers and rows, trimming header whitespace", () => {
    const csv = " name , age \nAlice,30\nBob,25\n";
    const r = parseCsv(csv);
    expect(r.columns).toEqual(["name", "age"]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ name: "Alice", age: "30" });
  });
  it("skips empty lines", () => {
    const r = parseCsv("a,b\n1,2\n\n3,4\n");
    expect(r.rows).toHaveLength(2);
  });
});

describe("parseXlsx", () => {
  it("parses the first sheet into rows", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["name", "score"],
      ["Alice", 90],
      ["Bob", 80],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

    const r = parseXlsx(buf);
    expect(r.columns).toEqual(["name", "score"]);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ name: "Alice", score: 90 });
  });
  it("returns empty for an empty workbook", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), "Sheet1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const r = parseXlsx(buf);
    expect(r.rows).toHaveLength(0);
  });
});

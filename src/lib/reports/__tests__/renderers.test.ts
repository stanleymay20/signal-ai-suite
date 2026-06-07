import { describe, expect, it } from "vitest";
import { buildReport } from "../buildReport";
import { renderReportPdf } from "../renderPdf";
import { renderReportPptx } from "../renderPptx";
import { fullPkg } from "./_fixtures";

describe("PDF renderer", () => {
  it("produces a non-empty PDF byte stream from a report model", async () => {
    const r = buildReport({ type: "executive_summary", pkg: fullPkg() });
    const bytes = await renderReportPdf(r);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(500);
    // PDF magic header.
    const header = String.fromCharCode(...bytes.subarray(0, 5));
    expect(header).toBe("%PDF-");
  });
});

describe("PPTX renderer", () => {
  it("produces a non-empty PPTX (zip) byte stream from a report model", async () => {
    const r = buildReport({ type: "boardroom", pkg: fullPkg() });
    const bytes = await renderReportPptx(r);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);
    // PPTX is a zip — starts with PK\x03\x04.
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
}, 20000);

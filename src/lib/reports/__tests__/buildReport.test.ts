import { describe, expect, it } from "vitest";
import { buildReport, narrativeSlots } from "../buildReport";
import type { ReportType } from "../types";
import { fullPkg, emptyPkg } from "./_fixtures";

const TYPES: ReportType[] = [
  "executive_summary",
  "boardroom",
  "risk_brief",
  "forecast_brief",
  "anomaly_investigation",
];

describe("buildReport — deterministic shape", () => {
  for (const t of TYPES) {
    it(`${t} has stable structure across builds`, () => {
      const now = new Date("2026-06-07T00:00:00Z");
      const a = buildReport({ type: t, pkg: fullPkg(), now });
      const b = buildReport({ type: t, pkg: fullPkg(), now });
      // Same inputs → identical model (excluding narrative .text which is unset).
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      expect(a.type).toBe(t);
      expect(a.title).toContain("sales.csv");
      expect(a.footer).toMatch(/Generated from Signal AI Suite/);
      expect(a.generatedAt).toBe(now.toISOString());
      // Narratives start empty.
      for (const s of a.sections) {
        if (s.type === "narrative") expect(s.text).toBeUndefined();
      }
    });
  }

  it("executive_summary contains KPI sections and a recommendations slot", () => {
    const r = buildReport({ type: "executive_summary", pkg: fullPkg() });
    expect(r.sections.some((s) => s.type === "kpis")).toBe(true);
    expect(narrativeSlots(r).map((n) => n.slot)).toContain("recommendations");
  });

  it("boardroom contains an anomaly table and a decisions slot", () => {
    const r = buildReport({ type: "boardroom", pkg: fullPkg() });
    expect(
      r.sections.some((s) => s.type === "table" && s.heading === "Top Anomalies"),
    ).toBe(true);
    expect(narrativeSlots(r).map((n) => n.slot)).toContain("boardroom_decisions");
  });

  it("forecast_brief includes a model comparison table from persisted metrics", () => {
    const r = buildReport({ type: "forecast_brief", pkg: fullPkg() });
    const table = r.sections.find(
      (s): s is Extract<typeof s, { type: "table" }> =>
        s.type === "table" && s.heading === "Model Comparison",
    );
    expect(table).toBeTruthy();
    // Numbers must come straight from evidence, not be invented.
    expect(table!.rows.length).toBe(2);
    expect(table!.rows[0]).toContain("14.2");
  });

  it("risk_brief surfaces risk drivers as bullets and exposes mitigation slot", () => {
    const r = buildReport({ type: "risk_brief", pkg: fullPkg() });
    const drivers = r.sections.find(
      (s): s is Extract<typeof s, { type: "bullets" }> =>
        s.type === "bullets" && s.heading.startsWith("Risk Drivers"),
    );
    expect(drivers).toBeTruthy();
    expect(drivers!.items.length).toBeGreaterThan(0);
    expect(narrativeSlots(r).map((n) => n.slot)).toContain("risk_mitigations");
  });

  it("anomaly_investigation lists top anomalies verbatim from evidence", () => {
    const r = buildReport({ type: "anomaly_investigation", pkg: fullPkg() });
    const t = r.sections.find(
      (s): s is Extract<typeof s, { type: "table" }> => s.type === "table",
    );
    expect(t).toBeTruthy();
    // First row corresponds to the highest-score anomaly (critical, t=2025-08).
    expect(t!.rows[0][0]).toBe("2025-08");
    expect(t!.rows[0][3]).toBe("critical");
  });

  it("emits citations only for present evidence sources", () => {
    const fr = buildReport({ type: "executive_summary", pkg: fullPkg() });
    const sources = new Set(fr.citations.map((c) => c.source));
    expect(sources.has("profile")).toBe(true);
    expect(sources.has("analysis")).toBe(true);
    expect(sources.has("forecast")).toBe(true);
    expect(sources.has("anomaly")).toBe(true);

    const er = buildReport({ type: "executive_summary", pkg: emptyPkg() });
    expect(er.citations).toEqual([]);
  });
});

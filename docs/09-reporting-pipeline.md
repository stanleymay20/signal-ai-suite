# 09 — Reporting Pipeline

Phase 7. Hybrid deterministic + AI narrative reports exported to PDF and PPTX
via Worker-safe libraries (`pdf-lib`, `pptxgenjs`). No Puppeteer / Chromium /
native canvas anywhere in the path.

## Flow

```text
EvidencePackage  (built by src/lib/ai/retrieval.ts — same one the chat uses)
        │
        ▼
ReportBuilder    (src/lib/reports/buildReport.ts)
   - KPIs, tables, bullets   ← from persisted DB rows
   - risk score & drivers    ← src/lib/reports/riskScoring.ts (pure TS)
   - citations               ← deriveCitations(evidence)
   - narrative SLOTS         ← deterministic prompts, no text yet
        │
        ▼
generateNarratives (src/lib/reports/narratives.ts)
   - one provider.chat() per slot
   - never mutates KPIs, tables, bullets, risk, or citations
   - failures fall back to a marked placeholder
        │
        ▼
persisted in `reports` table
   - sections, narratives, citations, risk_score, evidence_snapshot,
     ai_model, ai_provider
        │
        ▼
PDF / PPTX renderers (renderPdf.ts / renderPptx.ts)
   - consume the persisted ReportModel
   - never call the AI again — re-export is fully reproducible
```

## Report types

| Type                    | Audience           | Distinct sections                                                     |
| ----------------------- | ------------------ | --------------------------------------------------------------------- |
| `executive_summary`     | Execs              | Profile + Forecast + Anomaly KPIs, exec summary, recommendations      |
| `boardroom`             | Board / leadership | Headline, KPIs, commentary, top anomalies table, decisions requested  |
| `risk_brief`            | Risk owners        | Risk drivers + score, interpretation, mitigations                     |
| `forecast_brief`        | Analysts           | Forecast KPIs, model comparison, assumptions, interpretation, caveats |
| `anomaly_investigation` | Investigators      | Anomaly summary, top anomalies, interpretation, recommended actions   |

## Non-negotiable architecture

Deterministic (never AI):

- KPIs, tables, bullets, model comparison
- Forecast values
- Risk scores and drivers
- Citations
- All numeric metrics

AI-generated (narrative only):

- Executive summary text
- Boardroom commentary
- Forecast interpretation
- Anomaly interpretation
- Recommendations

The AI may explain evidence but must never create new evidence.

## Risk score

Pure function of the evidence package. Weighted components:

- data quality (0.20)
- missing-cell fraction (0.10)
- forecast MAPE (0.25)
- weighted anomaly load (0.35)
- evidence gaps (0.10)

Result is 0–100 mapped to bands: `low (<20)`, `moderate (<40)`,
`elevated (<60)`, `high (<80)`, `critical (≥80)`. Drivers are emitted as
plain-language strings so they can be rendered verbatim in any output
format.

## Persistence

Table `public.reports` (workspace-scoped, RLS-enforced):

- `type`, `title`
- `sections` — full deterministic + narrative-filled section list
- `narratives` — slot → text map (for re-rendering with future templates)
- `citations` — deterministic citation list
- `risk_score` — `{score, level, drivers}`
- `evidence_snapshot` — which evidence sources existed at generation time
- `ai_model`, `ai_provider`

## Exports

- `exportReportPdf(reportId)` → `{filename, contentType, base64}` rendered
  with `pdf-lib` (Helvetica). Streamed back as base64 so the browser can
  decode without a separate file route.
- `exportReportPptx(reportId)` → same shape, rendered with `pptxgenjs`
  using `outputType: "arraybuffer"`.

Both renderers consume the persisted `ReportModel` — they never call the
AI, so re-exporting an old report produces the same output as the first
download.

## Audit

- `report.generated` — includes risk score, type, provider, model
- `report.deleted`
- `report.exported` — includes format (`pdf` or `pptx`)

## Footer (every report, every format)

> Generated from Signal AI Suite evidence package. All metrics, forecasts,
> anomalies, and citations are derived from deterministic analysis outputs.
> AI-generated narrative sections are grounded exclusively in cited
> evidence available at generation time.

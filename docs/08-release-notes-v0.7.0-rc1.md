# 08 — Release Notes — v0.7.0-rc1

**Tag:** `v0.7.0-rc1`
**Date:** 2026-06-07
**Status:** Release candidate. First serious portfolio release.

## What's in this RC

| Phase | Title | Status |
| --- | --- | --- |
| 1 | Foundation (auth, workspaces, RLS, audit) | ✅ |
| 2 | Data ingestion + profiling | ✅ |
| 3 | Exploratory analysis | ✅ |
| 4 | Forecasting | ✅ |
| 4.1 | Forecast-residual hardening (exact backtest persistence) | ✅ |
| 5 | Anomaly detection (5 methods) | ✅ |
| 5.1 | Forecast-residual exactness | ✅ |
| 6 | Conversational intelligence layer | ✅ |

## Quality bar at this RC

- **130 unit tests passing** across analysis, forecasting, anomalies,
  AI retrieval, citations, prompts, and provider adapters.
- **Typecheck clean** (strict TS).
- **Lint clean** (ESLint).
- **CI green.**
- **RLS** on every user-facing table, validated by helper-function
  policy shape.
- **Audit log** entries for every phase-completing operation.

## Architectural guarantees

- AI never produces metrics, forecasts, anomalies, or citations.
- Citations are derived from persisted DB rows before the model call.
- Provider is environment-selected (Ollama by default, OpenAI-compatible
  including Lovable AI Gateway as fallback).
- The pipeline is one-way: each stage reads only persisted artefacts
  from earlier stages.

## Known limitations (intentional at RC)

- No streaming chat. Phase 6 ships synchronous chat to keep the citation
  contract simple. Streaming is a Phase 8+ concern.
- No report exports (PDF / PPTX). That is the entire scope of Phase 7.
- Single-dataset chat. Cross-dataset reasoning is out of scope.
- No tool-calling. Deliberate: the model is a presentation layer, not an
  agent.
- No background scheduling for re-runs. Phase ≥8.

## What ships next — Phase 7

Executive Reporting & Decision Intelligence. Hybrid architecture:

- deterministic structure (numbers, charts, tables, citations, risk
  scores) from the evidence package
- AI-generated narrative sections only (exec summary, boardroom summary,
  forecast interpretation, anomaly interpretation, recommendations)
- exports via Worker-compatible libraries (`pdf-lib`, `pptxgenjs`); no
  Puppeteer / Chromium / native canvas
- every report carries "Generated from evidence package on <timestamp>"
  and an explicit grounding footer

# Signal AI Suite — Documentation

**Release:** `v0.7.0-rc1` — first portfolio release candidate.
**Date:** 2026-06-07

Signal AI Suite is an evidence-grounded analytics copilot. Users upload tabular
datasets; the platform profiles them, runs exploratory analysis, generates
forecasts, detects anomalies, and exposes a conversational assistant that
**explains** the resulting evidence rather than inventing new insights.

The architectural backbone is a one-way pipeline:

```text
Dataset → Profile → Analysis → Forecast → Anomalies → Evidence Package → AI Explanation Layer
```

The AI layer never bypasses this pipeline. It receives a deterministically
built Evidence Package and produces narrative on top of it — every citation
is derived from real DB rows, not from the model.

## Doc index

| Doc | What it covers |
| --- | --- |
| [01 — Architecture](./01-architecture.md) | High-level system, runtime topology, layering rules |
| [02 — ERD](./02-erd.md) | Database tables, columns, relationships |
| [03 — RLS Model](./03-rls-model.md) | Workspace-scoped security, helper functions, audit |
| [04 — Provider Abstraction](./04-provider-abstraction.md) | AI provider interface, env-driven selection |
| [05 — Forecasting Pipeline](./05-forecasting-pipeline.md) | Models, backtest, metrics, persistence |
| [06 — Anomaly Pipeline](./06-anomaly-pipeline.md) | Detection methods, severity, forecast residuals |
| [07 — AI Grounding Flow](./07-ai-grounding-flow.md) | Evidence package, citation engine, prompts |
| [08 — Release Notes](./08-release-notes-v0.7.0-rc1.md) | RC scope, phase log, known limitations |
| [09 — Reporting Pipeline](./09-reporting-pipeline.md) | Phase 7 — hybrid deterministic + AI narrative reports, PDF/PPTX |
| [10 — Observability & Admin](./10-observability.md) | Phase 8 — `usage_events`, telemetry helper, admin control center |
| [11 — Enterprise Hardening](./11-enterprise-hardening.md) | Phase 9a — rate limits, signed-URL exports, job queue, retention, user mgmt |
| [12 — Deployment Checklist](./12-deployment-checklist.md) | Phase 9b — env vars, Supabase setup, buckets, pg_cron, monitoring, rollback |

## Quality signals at Phase 9a

- 173 unit tests passing (169 prior + 4 new rate-limiter tests)
- Typecheck clean, ESLint clean (0 errors)
- CI green
- RLS enforced on every user-facing table including `jobs` and `rate_limits`
- Per-user rate limits on chat, report, forecast, anomaly, export actions
- Signed-URL report exports (1 h expiry, private `reports` bucket)
- Background job queue with worker route `/api/public/hooks/jobs-tick` (pg_cron every minute)
- Daily retention purge of usage events (90 d), audit logs (180 d), rate-limit buckets (7 d)
- Admin Control Center extended with Users and Workspaces panels (role toggle is audit-logged)
- No AI-generated metrics, forecasts, anomalies, citations, or risk scores

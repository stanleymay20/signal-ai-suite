# 01 — Architecture

## Runtime topology

```text
┌──────────────────────────┐
│  Browser (React 19)      │
│  TanStack Router routes  │
│  AI chat UI + dashboards │
└────────────┬─────────────┘
             │  serverFn RPC (typed)
             │  + Supabase JS (auth/session)
             ▼
┌──────────────────────────┐
│  TanStack Start server   │   Cloudflare Worker runtime
│  - createServerFn         │   - requireSupabaseAuth middleware
│  - server routes (/api)   │   - attachSupabaseAuth (client→server)
└────────────┬─────────────┘
             │  PostgREST + RPC
             ▼
┌──────────────────────────┐
│  Supabase (Postgres)     │
│  - RLS per workspace     │
│  - audit_logs            │
│  - Storage: datasets/    │
└──────────────────────────┘
```

There is no separate API gateway, no edge functions, and no background worker
process. All app-internal logic runs through `createServerFn`. The only HTTP
surface area is under `src/routes/api/` and is reserved for webhooks /
sitemaps / public endpoints.

## Layering rules

1. **UI** (`src/routes/**`, `src/components/**`) — never imports Supabase
   admin clients, never reads `process.env` at module scope.
2. **Server functions** (`src/lib/*.functions.ts`) — the only callable
   boundary from UI. Every protected fn declares
   `.middleware([requireSupabaseAuth])`.
3. **Pure libraries** (`src/lib/analysis/**`, `forecasting/**`,
   `anomalies/**`, `ai/**`, `data-profiling/**`) — pure TypeScript,
   no DB / no network. Unit-tested in isolation.
4. **Integrations** (`src/integrations/supabase/**`) — auto-generated
   clients and middleware. Hand edits are forbidden.

The pure-library layer is what makes the test suite (130 tests) meaningful:
analysis, forecasting, anomaly detection, citation derivation, and provider
adapters are all exercised without touching the database.

## Pipeline (one-way, evidence-first)

```text
upload  ──▶ dataset_profiles
                │
                ▼
            analyses ──▶ insights_json / anomalies_json
                │
                ▼
           forecasts  (forecast_points, intervals,
                       metrics, backtest_points)
                │
                ▼
         anomaly_runs (zscore / mad / iqr / rolling_z /
                       forecast_residual)
                │
                ▼
   Evidence Package (built in src/lib/ai/retrieval.ts)
                │
                ▼
        Conversations / Messages
        (AI = narrative, citations are deterministic)
```

Each downstream stage only reads persisted artefacts from earlier stages —
the AI layer cannot short-circuit the pipeline.

## Why this matters

- **No hallucinated metrics.** Numbers, forecasts, and anomalies are produced
  by tested TypeScript, never by a model.
- **Deterministic citations.** `deriveCitations(evidence)` runs before the
  model call, so citations cannot be invented.
- **Provider independence.** The AI layer is wrapped behind an interface
  (`AIProvider`); swapping vendors does not change the pipeline.
- **Reproducibility.** Re-running a phase from the same inputs produces the
  same artefacts; only narrative paragraphs are model-variable.

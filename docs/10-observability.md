# 10 · Observability & Admin Control Center

Phase 8 adds a single-source-of-truth telemetry layer that records every
important user-facing action as a row in the `usage_events` table. The
Admin Control Center reads those rows to render system health, AI cost,
latency percentiles, error rates, top users, and the recent event log.

---

## `usage_events` table

| column              | type        | notes                                    |
| ------------------- | ----------- | ---------------------------------------- |
| `id`                | uuid        | PK                                       |
| `actor_id`          | uuid        | nullable FK → `auth.users`               |
| `workspace_id`      | uuid        | optional                                 |
| `action`            | text        | e.g. `chat.message`, `report.generate`   |
| `resource_type`     | text        | e.g. `dataset`, `conversation`           |
| `resource_id`       | uuid        | the resource the action targeted         |
| `status`            | text        | `success` or `error` (check constraint)  |
| `duration_ms`       | int         | wall-clock time spent inside the handler |
| `provider`          | text        | AI provider (when applicable)            |
| `model`             | text        | AI model                                 |
| `prompt_tokens`     | int         | from `ChatUsage`                         |
| `completion_tokens` | int         | from `ChatUsage`                         |
| `total_tokens`      | int         | sum                                      |
| `cost_usd`          | numeric     | from `estimateCostUsd(model, p, c)`      |
| `error_message`     | text        | first 1000 chars on `status='error'`     |
| `metadata`          | jsonb       | extra context (report id, methods, …)    |
| `created_at`        | timestamptz | default `now()`                          |

### Access rules

- **INSERT**: authenticated users may insert rows where `actor_id = auth.uid()`.
- **SELECT**: users may read their own rows. Admins may read all rows via
  `public.has_role(auth.uid(), 'admin')`.
- **UPDATE / DELETE**: not granted to any role — usage events are
  immutable, like `audit_logs`.

Indexes: `(created_at DESC)`, `(action)`, `(actor_id)`, `(status)`.

---

## Telemetry helper

`src/lib/observability/telemetry.ts` exposes:

- `startTelemetry(supabase, base)` — returns `{ success, error, elapsedMs }`.
- `withTelemetry(supabase, base, fn, { extract })` — wraps a function.
- `recordUsageEvent(...)` — low-level insert.
- `estimateCostUsd(model, prompt, completion)` — rough per-1K-token rates
  for `gpt-4o-mini`, `gpt-4o`, `gpt-4.1-mini`, `gemini-2.5-flash`,
  `gemini-2.5-pro`, and `llama3*`. Unknown models return `0`.

**Best-effort invariant:** every insert is wrapped in a `try/catch` that
swallows the error. Telemetry must never break the underlying feature.

---

## Wired actions

| action            | recorded inside                                     |
| ----------------- | --------------------------------------------------- |
| `chat.message`    | `sendChatMessage` (with provider/model/tokens/cost) |
| `report.generate` | `generateReport` (with provider/model)              |
| `forecast.run`    | `runDatasetForecast`                                |
| `anomaly.run`     | `runAnomalyDetectionFn`                             |

Each call records `success` with `duration_ms` on the happy path, or
`error` with `error_message` on the failure path. The existing
`audit_logs` table is **kept**: audit logs capture _what changed_ (CRUD),
while `usage_events` captures _how the system performed_.

---

## Admin Control Center

Route: `/admin` (gated by `profiles.role = 'admin'`).

Server functions (in `src/lib/admin.functions.ts`):

- `isCurrentUserAdmin()` — quick check used by the nav.
- `getSystemHealth({ windowHours })` — aggregates the last _N_ hours
  into `overview`, `byAction`, `byProviderModel`, `topUsers` using the
  pure helpers in `src/lib/observability/aggregations.ts`.
- `listUsageEvents({ limit, status, action })` — paginated recent log.

The admin page renders:

- **Overview cards**: events, error rate, tokens & AI spend, latency
  (p50 / p95 / avg).
- **By action**: count, error rate, latency percentiles, tokens, cost.
- **AI cost · by model**: per provider/model totals.
- **Top users**: actor IDs ranked by event count and spend.
- **Recent events**: a scrolling log with status pill and `error_message`
  preview.

Aggregations are computed entirely in JS from the raw rows returned by
the database — no PG functions or materialized views — so the dashboard
stays correct as soon as new events are written, and the same pure
functions are unit-tested.

---

## Tests

`src/lib/observability/__tests__/`:

- `telemetry.test.ts` — success/error paths, token math, cost
  estimation, swallowed-error contract.
- `aggregations.test.ts` — percentile correctness, per-action grouping,
  AI cost grouping, top-users ranking.

Total project test count after Phase 8: **169 passing**.

# 11 — Enterprise Hardening (Phase 9a)

This phase introduces the operational primitives required for Signal AI Suite
to run as a multi-tenant production system: rate limiting, signed-URL
exports, a background-job queue, admin user management, and a data-retention
policy. End-to-end tests and a deployment checklist follow in Phase 9b.

## 1. Rate limiting

### Goals

- Bound runaway loops, abuse, and accidental cost spikes.
- Apply per-user, per-action so one workspace cannot starve another.
- Be best-effort: telemetry/queue glitches must never block legitimate work.

### Data model

- Table `rate_limits(user_id, action, window_start, count)` — primary key
  `(user_id, action, window_start)`. Indexed on `window_start` for purge.
- Function `public.check_rate_limit(_user_id, _action, _max, _window_seconds)`
  performs an atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING count` and
  returns `{ allowed, count, limit, remaining, window_start, reset_at }`.
- Buckets are fixed windows derived from `floor(epoch / window) * window`.

### Defaults (`src/lib/observability/rateLimit.ts`)

| Action            | Max | Window |
| ----------------- | --- | ------ |
| `chat.message`    | 30  | 60s    |
| `report.generate` | 10  | 5 min  |
| `forecast.run`    | 10  | 5 min  |
| `anomaly.run`     | 10  | 5 min  |
| `report.export`   | 30  | 60s    |

### Wiring

`enforceRateLimit(supabase, userId, RATE_LIMITS.X)` runs at the top of every
hot server function (`sendChatMessage`, `generateReport`, `runDatasetForecast`,
`runAnomalyDetectionFn`, `exportReportPdf/Pptx`). On exhaustion it throws a
`RateLimitError` which surfaces to the client as a 4xx-equivalent message
including the reset time.

## 2. Signed-URL exports

Report exports no longer round-trip large base64 payloads through the RPC
response. Instead:

1. The renderer produces PDF/PPTX bytes (deterministic, no AI re-call — the
   persisted `ReportModel` snapshot is consumed verbatim).
2. The service-role client uploads to the private `reports` bucket at
   `<workspace_id>/<report_id>/<format>/<slug>.<ext>` with `upsert: true`.
3. A 1-hour signed URL is generated with `download=<filename>` so the browser
   downloads with the right name.
4. The client triggers a normal anchor click — no Blob, no base64, no atob.

This keeps memory usage flat regardless of report size and lets future
mobile/email clients consume the same URL.

## 3. Background job queue

### Why

Some operations (large dataset profiling, multi-model forecasts, executive
report generation) can take longer than is comfortable inside a request.
A queue moves them off the request path and makes retries first-class.

### Schema

- Enum `job_status`: `queued | running | succeeded | failed | cancelled`.
- Enum `job_type`: `dataset_profile | analysis | forecast | anomaly | report`.
- Table `jobs(workspace_id, dataset_id?, created_by, type, status, payload,
result, error_message, attempts, max_attempts, scheduled_at, …)`.
- RLS: workspace members read/insert their workspace's jobs; only admins (or
  service role) mutate lifecycle.

### Worker

- `public.claim_next_job()` (SECURITY DEFINER) atomically picks one queued
  row with `FOR UPDATE SKIP LOCKED` and flips it to `running`.
- Route `POST /api/public/hooks/jobs-tick` (auth via Supabase publishable
  key in `apikey` header) calls `processOneJob()` up to 5 times per tick
  or until a 25 s soft deadline.
- Handler registry in `src/lib/jobs/dispatcher.server.ts` dispatches by
  `type`. Registered handlers in this phase: `report` → `runReportJob`.
- Failed jobs are re-queued automatically until `attempts >= max_attempts`,
  then transitioned to `failed` with `error_message`.

### Scheduling

`pg_cron` job `signal-ai-jobs-tick` runs every minute and posts to the
hook URL with the project's anon key.

## 4. Data-retention policy

Single SQL function `public.purge_telemetry_retention(usage_days,
audit_days, rate_limit_days)` deletes:

- `usage_events` older than 90 days (default)
- `audit_logs` older than 180 days
- `rate_limits` buckets older than 7 days

Scheduled daily at 03:15 UTC via `pg_cron` job `signal-ai-retention-purge`.
The function is SECURITY DEFINER and `EXECUTE` is restricted to
`service_role`, so neither anon nor authenticated roles can invoke it.

## 5. Admin user management

The `/admin` Control Center now includes:

- **Users panel** — full profile list with role chip and a one-click
  "Make admin / member" toggle (audit-logged as `admin.role_changed`).
- **Workspaces panel** — owner and creation date for every workspace.

Server functions live in `src/lib/admin.functions.ts`:
`listAllUsers`, `setUserRole`, `listAllWorkspaces`. All three call
`ensureAdmin(supabase, userId)` for a clear "Admin access required"
error before touching data; RLS provides defence-in-depth.

`setUserRole` refuses to demote the calling admin to avoid lockouts.

## 6. Tests & quality signals

- **173 tests passing** (169 prior + 4 new in
  `src/lib/observability/__tests__/rateLimit.test.ts`).
- Lint, typecheck, build: clean.
- DB linter: warnings limited to pre-existing SECURITY DEFINER helpers
  (`has_role`, `is_workspace_member`, etc.) and the intentional new ones
  (`check_rate_limit` callable by authenticated; `claim_next_job` and
  `purge_telemetry_retention` restricted to `service_role`).

## Phase 9b — pending

- Playwright E2E for upload → analyze → forecast → report.
- Deployment checklist (env vars, cron schedules, retention policies,
  storage bucket policies, rate-limit tuning, on-call runbook).

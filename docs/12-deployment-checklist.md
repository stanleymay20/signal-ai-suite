# 12 — Deployment Checklist (Phase 9b)

End-of-line checklist for taking Signal AI Suite from preview to production.
Tick every item before any production rollout, and re-tick after each major
release.

## 1. Environment variables

### Client (browser-visible, `VITE_*`)
| Variable                       | Required | Notes                                                       |
| ------------------------------ | -------- | ----------------------------------------------------------- |
| `VITE_SUPABASE_URL`            | yes      | Production Supabase URL                                     |
| `VITE_SUPABASE_PUBLISHABLE_KEY`| yes      | Publishable / anon key (safe to ship in the bundle)         |
| `VITE_SUPABASE_PROJECT_ID`     | yes      | Used by generated types only                                |

### Server (Cloudflare Worker / TanStack runtime)
| Variable                       | Required | Notes                                                       |
| ------------------------------ | -------- | ----------------------------------------------------------- |
| `SUPABASE_URL`                 | yes      | Same value as `VITE_SUPABASE_URL`                           |
| `SUPABASE_PUBLISHABLE_KEY`     | yes      | Used by `requireSupabaseAuth` middleware                    |
| `SUPABASE_SERVICE_ROLE_KEY`    | yes      | Service-role; admin client + report upload + jobs           |
| `LOVABLE_API_KEY`              | yes      | Lovable AI Gateway access                                   |

Optional / situational:

| Variable                       | When needed                                                 |
| ------------------------------ | ----------------------------------------------------------- |
| `OPENAI_API_KEY`               | If switching `AI_PROVIDER=openai`                           |
| `OLLAMA_URL`                   | If using a self-hosted Ollama runtime                       |
| `AI_PROVIDER`                  | Override provider selection (`lovable` default)             |
| `AI_MODEL`                     | Override default model id                                   |

> **Never** rename service keys to `VITE_*` — that would ship them to the
> browser. **Never** read secrets at module scope in shared files; read inside
> `.handler()` blocks or server-only modules.

## 2. Supabase setup

- [ ] Run every migration in `supabase/migrations/` in order against the
      production project (`supabase db push`).
- [ ] Confirm RLS is **enabled** on every table in the `public` schema:
      `select relname from pg_class where relkind = 'r' and relnamespace = 'public'::regnamespace and not relrowsecurity;` must return zero rows.
- [ ] Run `supabase--linter` and review remaining warnings — only pre-existing
      `SECURITY DEFINER` helpers and the documented Phase 9a additions
      (`check_rate_limit`, `claim_next_job`, `purge_telemetry_retention`)
      should remain.
- [ ] Confirm `pg_cron` and `pg_net` extensions are enabled.
- [ ] Email/password auth enabled; HIBP password check enabled.
- [ ] Google OAuth provider configured (Lovable broker handles client-side
      flow; provider must still be enabled in Supabase Auth).
- [ ] Email confirmations: on for production.

## 3. Storage buckets

| Bucket     | Public? | Purpose                                  | Path scheme                                          |
| ---------- | ------- | ---------------------------------------- | ---------------------------------------------------- |
| `datasets` | private | Raw user uploads (CSV / XLSX)            | `<workspace_id>/<dataset_id>/<filename>`             |
| `reports`  | private | Rendered PDF / PPTX exports              | `<workspace_id>/<report_id>/<format>/<filename>`     |

- [ ] Both buckets exist and are **private**.
- [ ] No public bucket policies attached.
- [ ] Lifecycle / size limits set in the Supabase dashboard (recommend
      50 MB per object for `datasets`, 25 MB for `reports`).

## 4. pg_cron jobs

Two scheduled jobs are required. Verify with `select * from cron.job;`.

```sql
-- A. Background-job worker tick (every minute)
SELECT cron.schedule(
  'signal-ai-jobs-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<production-host>/api/public/hooks/jobs-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', '<SUPABASE_PUBLISHABLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- B. Retention purge (daily, 03:15 UTC)
SELECT cron.schedule(
  'signal-ai-retention-purge',
  '15 3 * * *',
  $$ SELECT public.purge_telemetry_retention(90, 180, 7); $$
);
```

- [ ] Both jobs scheduled, last run successful (`select * from
      cron.job_run_details order by start_time desc limit 10;`).
- [ ] Production host in job A matches `project--<id>.lovable.app` or the
      custom domain — must be a **stable** URL.

## 5. Job-tick auth secret

The job-worker route `/api/public/hooks/jobs-tick` authenticates by requiring
an `apikey` header equal to `SUPABASE_PUBLISHABLE_KEY` (the Supabase
publishable / anon key). This is the platform-standard pattern for
`/api/public/*` callbacks from `pg_cron`.

- [ ] The pg_cron job above includes the `apikey` header with the
      production publishable key.
- [ ] Rotating Supabase keys requires re-running `cron.schedule(...)` with
      the new key. (Tracked separately in §10 Rotation.)

## 6. AI provider configuration

- [ ] `LOVABLE_API_KEY` set in production Worker env (default provider).
- [ ] If using OpenAI: `AI_PROVIDER=openai` + `OPENAI_API_KEY`.
- [ ] If using Ollama: `AI_PROVIDER=ollama` + `OLLAMA_URL` reachable from
      the Worker.
- [ ] Verify the provider responds with `curl` from the deployed Worker
      (use `/api/public/...` smoke route or the chat UI).
- [ ] Confirm the provider supports the configured `AI_MODEL`.

## 7. Backup strategy

- [ ] Supabase automated daily backups enabled (Project Settings → Database
      → Backups). 7-day retention minimum for production tier.
- [ ] Point-in-time recovery enabled if the plan supports it.
- [ ] Monthly **restore drill** to a scratch project — restore the latest
      backup and run `bun run test:e2e` against it.
- [ ] Storage buckets: export critical reports/datasets to long-term cold
      storage (e.g. S3 / R2) on a weekly schedule. Supabase Storage backups
      are not automatic.

## 8. Monitoring checklist

Pulled from Phase 8 telemetry + Phase 9a additions.

- [ ] `/admin` Control Center reachable by at least 2 admins.
- [ ] Alert when **error rate** on `chat.message` / `report.generate` /
      `forecast.run` / `anomaly.run` > 2 % over a 15 min window.
- [ ] Alert when **p95 latency** for chat > 8 s or for report generation
      > 30 s sustained over 15 min.
- [ ] Alert when **token spend** in 24 h exceeds the configured cap.
- [ ] Alert when `cron.job_run_details` shows ≥ 2 consecutive failed runs
      for either scheduled job.
- [ ] Alert when `jobs` table has any row in `failed` for > 1 h.
- [ ] Alert when `rate_limits` shows > 100 distinct users hitting the
      ceiling in 24 h (potential abuse or limit-too-tight signal).
- [ ] External uptime check on `/` and `/api/public/hooks/jobs-tick`
      (expect 200 / 401-without-apikey respectively).

## 9. Rollback plan

Tag-and-revert flow:

1. Every production deploy is tagged in GitHub (`v0.X.Y`).
2. To roll back the **frontend**: in Lovable, open the project → Versions
   → restore previous tag → click **Update** in the publish dialog.
3. To roll back the **backend** (server functions / routes): the same
   restore covers it — they ship in the same bundle.
4. To roll back **database migrations**: prepare a paired *down*
   migration alongside each new schema-changing migration. If none exists,
   restore from the most recent Supabase backup (§7).
5. To roll back **pg_cron** changes: keep the previous `cron.schedule` SQL
   in version control under `supabase/migrations/`. Re-apply the prior
   version.
6. To roll back **storage bucket policies**: re-run the previous
   `supabase--storage_update_bucket` call. (Bucket policies are tracked in
   migrations; never edit ad-hoc in the dashboard.)

Communicate every rollback in the on-call channel with: who, what, why,
which tag was restored, and which migrations (if any) were reverted.

## 10. Rotation

- [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY` quarterly. After rotation, redeploy
      the Worker and update `cron.schedule(...)` for `signal-ai-jobs-tick`.
- [ ] Rotate `LOVABLE_API_KEY` via `lovable_api_key--rotate_lovable_api_key`
      quarterly.
- [ ] Rotate user-supplied provider keys (OpenAI / others) per their own
      vendor policy.

## 11. Pre-flight before each release

- [ ] `bun run audit:ci` clean locally (lint + typecheck + tests + build).
- [ ] CI green on the release commit.
- [ ] `bun run test:e2e` green against the preview deployment (Phase 9b).
- [ ] Release notes updated (`docs/08-release-notes-*.md`).
- [ ] Manual smoke: sign in → upload sample → analysis → forecast →
      anomaly → report → PDF export → chat reply.
- [ ] Admin Control Center: latency, error rate, recent events all
      look healthy for the last 24 h.

## Starter GitHub Actions job for E2E

```yaml
e2e:
  name: Playwright E2E
  runs-on: ubuntu-latest
  needs: build
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  timeout-minutes: 30
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with: { bun-version: latest }
    - run: bun install --frozen-lockfile
    - run: bun add -D @playwright/test
    - run: bunx playwright install --with-deps chromium
    - run: bun run test:e2e
      env:
        E2E_BASE_URL: ${{ secrets.E2E_BASE_URL }}
        E2E_TEST_EMAIL: ${{ secrets.E2E_TEST_EMAIL }}
        E2E_TEST_PASSWORD: ${{ secrets.E2E_TEST_PASSWORD }}
        E2E_ADMIN_EMAIL: ${{ secrets.E2E_ADMIN_EMAIL }}
        E2E_ADMIN_PASSWORD: ${{ secrets.E2E_ADMIN_PASSWORD }}
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report
        retention-days: 14
```

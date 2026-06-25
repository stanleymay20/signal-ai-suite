# Signal AI Suite — End-to-End Tests

Playwright suite covering the critical user journeys for Phase 9b.

## Prerequisites

```bash
bun add -D @playwright/test
bunx playwright install --with-deps chromium
```

Set the following env vars before running:

| Variable             | Required | Purpose                                          |
| -------------------- | -------- | ------------------------------------------------ |
| `E2E_BASE_URL`       | yes      | Target origin (e.g. `https://app.example.com`)   |
| `E2E_TEST_EMAIL`     | yes      | Pre-provisioned member user                      |
| `E2E_TEST_PASSWORD`  | yes      | Password for the above                           |
| `E2E_ADMIN_EMAIL`    | no       | Pre-provisioned admin user                       |
| `E2E_ADMIN_PASSWORD` | no       | Password for the admin                           |
| `E2E_DATASET_PATH`   | no       | Local CSV/XLSX to upload (defaults to `e2e/fixtures/sample.csv`) |
| `E2E_DATASET_ID`     | no       | Pre-existing dataset to use for analysis/forecast/anomaly/report flows. When absent, the suite uses the dataset created by the upload spec. |

## Run

```bash
bun run test:e2e               # all specs
bunx playwright test auth      # one spec
bunx playwright test --ui      # interactive runner
```

## Suite

| Spec                       | Flow                                                  |
| -------------------------- | ----------------------------------------------------- |
| `auth.spec.ts`             | Sign in with email/password, redirect to dashboard    |
| `upload.spec.ts`           | Upload CSV → profiling completes → dataset detail     |
| `analysis.spec.ts`         | Run exploratory analysis and render charts            |
| `forecast.spec.ts`         | Configure & run a forecast, see metrics               |
| `anomalies.spec.ts`        | Run anomaly detection, see severity table             |
| `chat.spec.ts`             | Send a grounded chat message and read the reply       |
| `report.spec.ts`           | Generate a report and confirm sections render         |
| `export.spec.ts`           | Export PDF and PPTX via signed URL (download starts)  |
| `admin-access.spec.ts`     | Non-admin users cannot reach `/admin`                 |

Specs use `test.skip()` when prerequisites are missing so partial environments
still run a meaningful subset (e.g. admin-access requires `E2E_ADMIN_*`).

## CI integration

These tests are intentionally NOT wired into the default `bun run test`
(vitest) pipeline because they require a live deployment and provisioned
test users. Wire them up in a separate workflow job that:

1. Provisions a fresh Supabase preview project (or reuses a staging one)
2. Seeds the two test users + a workspace
3. Sets the `E2E_*` secrets
4. Runs `bun run test:e2e`

A starter GitHub Actions job lives in `docs/12-deployment-checklist.md`.

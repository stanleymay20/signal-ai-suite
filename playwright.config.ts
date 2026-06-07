/**
 * Playwright configuration for Signal AI Suite E2E tests.
 *
 * These tests are NOT part of the default `bun run test` (vitest) pipeline.
 * They run against a real preview/published deployment or a local `bun run dev`
 * instance, and require:
 *   - E2E_BASE_URL                — target origin (defaults to http://localhost:3000)
 *   - E2E_TEST_EMAIL              — pre-provisioned auth user
 *   - E2E_TEST_PASSWORD           — password for the above
 *   - E2E_ADMIN_EMAIL (optional)  — admin user for admin-access tests
 *   - E2E_ADMIN_PASSWORD (optional)
 *
 * Tests are skipped gracefully when required env vars are absent so CI lint
 * stays green even without secrets.
 *
 * Run locally:
 *   bun add -D @playwright/test
 *   bunx playwright install --with-deps chromium
 *   bun run test:e2e
 */
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

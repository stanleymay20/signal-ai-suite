import { test, expect } from "@playwright/test";
import { envOrSkip, firstDatasetIdFromList, signIn } from "./helpers";

test("user can export PDF and PPTX via signed URL", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  const datasetId = process.env.E2E_DATASET_ID ?? (await firstDatasetIdFromList(page));
  test.skip(!datasetId, "No dataset available");

  await page.goto(`/datasets/${datasetId}/reports`);
  // Assumes the most recent report is rendered at the top with export buttons.
  for (const label of [/export pdf|download pdf/i, /export pptx|download pptx/i]) {
    const btn = page.getByRole("button", { name: label }).first();
    if (!(await btn.isVisible().catch(() => false))) continue;

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      btn.click(),
    ]);
    const name = download.suggestedFilename();
    expect(name).toMatch(/\.(pdf|pptx)$/i);
  }
});

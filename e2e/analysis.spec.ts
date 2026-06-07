import { test, expect } from "@playwright/test";
import { envOrSkip, firstDatasetIdFromList, signIn } from "./helpers";

test("user can run exploratory analysis", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  const datasetId = process.env.E2E_DATASET_ID ?? (await firstDatasetIdFromList(page));
  test.skip(!datasetId, "No dataset available — run upload spec first or set E2E_DATASET_ID");

  await page.goto(`/datasets/${datasetId}/analysis`);
  const run = page.getByRole("button", { name: /run analysis|analyze/i }).first();
  if (await run.isVisible().catch(() => false)) await run.click();

  await expect(page.getByText(/trend|seasonality|distribution|correlation/i).first()).toBeVisible({
    timeout: 30_000,
  });
});

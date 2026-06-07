import { test, expect } from "@playwright/test";
import { envOrSkip, firstDatasetIdFromList, signIn } from "./helpers";

test("user can generate a report", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  const datasetId = process.env.E2E_DATASET_ID ?? (await firstDatasetIdFromList(page));
  test.skip(!datasetId, "No dataset available");

  await page.goto(`/datasets/${datasetId}/reports`);
  await page.getByRole("button", { name: /generate report|new report/i }).first().click();

  await expect(
    page.getByText(/executive summary|boardroom summary|recommendations/i).first(),
  ).toBeVisible({ timeout: 120_000 });
});

import { test, expect } from "@playwright/test";
import { envOrSkip, firstDatasetIdFromList, signIn } from "./helpers";

test("user can run a forecast", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  const datasetId = process.env.E2E_DATASET_ID ?? (await firstDatasetIdFromList(page));
  test.skip(!datasetId, "No dataset available");

  await page.goto(`/datasets/${datasetId}/forecast`);
  await page.getByRole("button", { name: /run forecast|forecast/i }).first().click();
  await expect(page.getByText(/mape|rmse|mae|forecast/i).first()).toBeVisible({
    timeout: 60_000,
  });
});

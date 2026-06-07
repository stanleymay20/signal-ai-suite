import { test, expect } from "@playwright/test";
import { envOrSkip, firstDatasetIdFromList, signIn } from "./helpers";

test("user can chat with grounded AI", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  const datasetId = process.env.E2E_DATASET_ID ?? (await firstDatasetIdFromList(page));
  test.skip(!datasetId, "No dataset available");

  await page.goto(`/datasets/${datasetId}/chat`);
  const input = page.locator('textarea, input[type="text"]').last();
  await input.fill("Summarize the dataset in one sentence.");
  await page.getByRole("button", { name: /send|submit/i }).first().click();

  // Assistant reply renders. Allow a long timeout for AI providers.
  await expect(page.locator("text=/.{20,}/").last()).toBeVisible({ timeout: 60_000 });
});

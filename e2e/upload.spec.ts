import path from "node:path";
import { test, expect } from "@playwright/test";
import { envOrSkip, signIn } from "./helpers";

test("upload CSV → profiling completes", async ({ page }) => {
  const email = envOrSkip("E2E_TEST_EMAIL");
  const password = envOrSkip("E2E_TEST_PASSWORD");
  test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

  await signIn(page, email!, password!);
  await page.goto("/datasets");
  await page.getByRole("button", { name: /upload dataset/i }).click();

  const file = process.env.E2E_DATASET_PATH ?? path.join(__dirname, "fixtures", "sample.csv");
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole("button", { name: /^upload$/i }).click();

  // Navigates to /datasets/:id once profiling finalizes.
  await expect(page).toHaveURL(/\/datasets\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.getByText(/rows|columns|quality/i).first()).toBeVisible();
});

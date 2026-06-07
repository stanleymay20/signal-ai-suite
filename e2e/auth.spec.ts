import { test, expect } from "@playwright/test";
import { envOrSkip, signIn } from "./helpers";

test.describe("auth", () => {
  test("user can sign in with email + password", async ({ page }) => {
    const email = envOrSkip("E2E_TEST_EMAIL");
    const password = envOrSkip("E2E_TEST_PASSWORD");
    test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

    await signIn(page, email!, password!);
    await expect(page).not.toHaveURL(/\/auth(\?|$)/);
  });

  test("anonymous users are redirected from protected routes", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/datasets");
    await expect(page).toHaveURL(/\/auth(\?|$)/, { timeout: 15_000 });
  });
});

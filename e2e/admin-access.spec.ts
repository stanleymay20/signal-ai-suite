import { test, expect } from "@playwright/test";
import { envOrSkip, signIn } from "./helpers";

test.describe("admin access protection", () => {
  test("non-admin members cannot reach /admin", async ({ page }) => {
    const email = envOrSkip("E2E_TEST_EMAIL");
    const password = envOrSkip("E2E_TEST_PASSWORD");
    test.skip(!email || !password, "E2E_TEST_EMAIL/PASSWORD not set");

    await signIn(page, email!, password!);
    await page.goto("/admin");

    // Either we get redirected, or the page renders an "Admin access required" message.
    const onAdmin = /\/admin(\/|$)/.test(page.url());
    if (onAdmin) {
      await expect(page.getByText(/admin access required|not authorized|forbidden/i)).toBeVisible({
        timeout: 10_000,
      });
    } else {
      expect(page.url()).not.toMatch(/\/admin(\/|$)/);
    }
  });

  test("admin user can reach /admin", async ({ page }) => {
    const email = envOrSkip("E2E_ADMIN_EMAIL");
    const password = envOrSkip("E2E_ADMIN_PASSWORD");
    test.skip(!email || !password, "E2E_ADMIN_EMAIL/PASSWORD not set");

    await signIn(page, email!, password!);
    await page.goto("/admin");
    await expect(page.getByText(/users|workspaces|control center|telemetry/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

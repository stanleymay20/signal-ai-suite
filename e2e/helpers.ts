import { expect, type Page } from "@playwright/test";

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

export function envOrSkip(name: string): string | null {
  return process.env[name] ?? null;
}

/** Sign in via the /auth page using email + password. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto("/auth");
  await page.getByLabel(/email/i).first().fill(email);
  await page.getByLabel(/password/i).first().fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  // After sign-in we land on /dashboard (or whatever the post-auth landing is).
  await expect(page).toHaveURL(/\/(dashboard|datasets|workspaces|$)/, {
    timeout: 15_000,
  });
}

/** Returns the first dataset id visible on /datasets, or null. */
export async function firstDatasetIdFromList(page: Page): Promise<string | null> {
  await page.goto("/datasets");
  const link = page.locator('a[href^="/datasets/"]').first();
  if ((await link.count()) === 0) return null;
  const href = await link.getAttribute("href");
  return href ? href.split("/").pop()! : null;
}

import { expect, test } from "@playwright/test";

test("loads app and shows dashboard or login", async ({ page }) => {
  await page.goto("/");

  // App should load - either dashboard (auth disabled) or login page (auth enabled)
  await expect(page).toHaveTitle(/Antfly/);

  // Check which state we're in
  const url = page.url();
  if (url.includes("/login")) {
    // Auth enabled - should see login form
    await expect(page.getByRole("heading", { name: "Sign in to Antfly" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  } else {
    // Auth disabled - should see dashboard
    await expect(page.getByRole("heading", { name: "Tables" })).toBeVisible();
  }
});

test("can navigate to tables page", async ({ page }) => {
  await page.goto("/");

  // Wait for app to load
  await expect(page).toHaveTitle(/Antfly/);

  // If we're on login, skip this test
  if (page.url().includes("/login")) {
    test.skip();
    return;
  }

  // Should see tables navigation
  await expect(page.getByRole("link", { name: "Tables" })).toBeVisible();

  // Click tables and verify we see the table list
  await page.getByRole("link", { name: "Tables" }).click();
  await expect(page.getByText("Filter Mode")).toBeVisible();
});

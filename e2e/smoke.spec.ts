import { expect, test } from "@playwright/test";

/**
 * Harness smoke proof (epic 3 story 1). Two assertions, but they cross the
 * whole chain the later suites depend on: the production server booted by the
 * harness, the proxy's auth gate, and the scratch-database boot path (the
 * server's first request triggers query() → ensureSchema() — if the database
 * were missing or wrong, every page would 500, not render).
 */
test("anonymous /login renders the sign-in page", async ({ page }) => {
  await page.goto("/login");

  await expect(page).toHaveTitle(/Sign in/);
  await expect(page.getByRole("heading", { name: "Sign in to Onyx" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  // exact: the password field's "Show password" toggle also substring-matches
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("anonymous deep link to /users redirects to /login with a next param", async ({ page }) => {
  await page.goto("/users");

  // The proxy redirects unauthenticated visits to protected prefixes.
  await expect(page).toHaveURL(/\/login\?next=%2Fusers$/);
  await expect(page.getByRole("heading", { name: "Sign in to Onyx" })).toBeVisible();
});

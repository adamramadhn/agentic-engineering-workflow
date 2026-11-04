import { expect, test } from "@playwright/test";
import {
  cleanupE2EFixtures,
  closeDbPool,
  login,
  seedUser,
} from "./helpers";

/**
 * Member 403 deep link verification (epic 3 story 3).
 *
 * Pins that a Member directly navigating to `/users` receives the in-app 403
 * ForbiddenView with the expected copy and Dashboard CTA, while proving zero
 * data requests (`/api/users` and `/api/roles`) leave the browser because the
 * PagePermissionGate denied access before UsersView could mount.
 */

const MEMBER_EMAIL = "member-forbidden@e2e.test";

test.describe("Member 403 deep-link to /users", () => {
  test.beforeAll(async () => {
    await seedUser({
      name: "Forbidden Member",
      email: MEMBER_EMAIL,
      role: "Member",
    });
  });

  test.afterAll(async () => {
    try {
      await cleanupE2EFixtures({ emails: [MEMBER_EMAIL] });
    } finally {
      await closeDbPool();
    }
  });

  test("renders in-app 403 with zero data requests leaving the browser", async ({ page }) => {
    await login(page, MEMBER_EMAIL);

    // Attach request recorder BEFORE navigation to /users
    const userHits: string[] = [];
    const roleHits: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/api/users")) userHits.push(url);
      if (url.includes("/api/roles")) roleHits.push(url);
    });

    await page.goto("/users");

    // In-app 403 view assertions
    await expect(
      page.getByRole("heading", { name: "You don't have access to this page" })
    ).toBeVisible();
    await expect(page.getByText("403", { exact: true })).toBeVisible();
    await expect(page.getByText(/View users/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();

    // Zero data requests recorded from navigation to rendered 403
    expect(userHits).toHaveLength(0);
    expect(roleHits).toHaveLength(0);

    // No data view of any kind (users table does NOT render)
    await expect(page.getByRole("heading", { name: "Users directory" })).toHaveCount(0);
  });
});

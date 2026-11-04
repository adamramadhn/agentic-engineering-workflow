import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import {
  api,
  auditRows,
  cleanupMatrixRoles,
  cleanupMatrixUsers,
  closeDbPool,
  FIXTURE_EMAILS,
  FIXTURE_PASSWORD,
  getPool,
  login,
  seedFixtureUsers,
  userIdByEmail,
} from "./helpers";

/**
 * Design §9 guard cases over real HTTP: the pinned failure modes of the
 * endpoint inventory (own-role 403, system-role delete 409, in-use delete 409 +
 * userCount, unknown permission 400 with no mutation, unknown role 400), the
 * deputy fresh-grant-resolution case — the reachable face of the
 * last-roles.manage-holder guard, whose 409 is unreachable over HTTP by
 * construction (the inventory records the proof) — and the users.role FK
 * rejected at the pg level.
 */

let adminCookie: string;

beforeAll(async () => {
  await seedFixtureUsers();
  adminCookie = await login(FIXTURE_EMAILS.admin, FIXTURE_PASSWORD);
});

afterEach(async () => {
  // Users before roles (users.role FK). The seeded fixture users survive so
  // later tests keep logging in; everything else this file created dies here.
  await cleanupMatrixUsers();
  await cleanupMatrixRoles();
});

afterAll(async () => {
  await cleanupMatrixUsers({ keep: [] });
  await cleanupMatrixRoles();
  await closeDbPool();
});

test("own-role permissions edit → 403 (no self-escalation / self-lockout)", async () => {
  const response = await api(`/api/roles/Admin/permissions`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { permissions: ["users.view"] },
  });
  expect(response.status).toBe(403);
  // The guard fires before any write: Admin's grants are untouched.
  const { rows } = await getPool().query<{ permissions: unknown }>(
    `SELECT permissions FROM roles WHERE key = 'Admin'`,
  );
  expect(rows[0]?.permissions).toEqual(["*"]);
});

test("DELETE of a system role → 409 (is_system check precedes the in-use check)", async () => {
  // Editor has an attached fixture user, so the in-use branch would also 409 —
  // the message pins WHICH branch fired.
  const response = await api(`/api/roles/Editor`, { method: "DELETE", cookie: adminCookie });
  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ error: "System roles cannot be deleted" });
});

test("DELETE of a role with attached users → 409 + userCount", async () => {
  const created = await api("/api/roles", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Matrix Guard Inuse" },
  });
  expect(created.status).toBe(201);
  const attached = await api("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Matrix Inuse User",
      email: "inuse@matrix.test",
      password: FIXTURE_PASSWORD,
      role: "matrix-guard-inuse",
    },
  });
  expect(attached.status).toBe(201);

  const response = await api(`/api/roles/matrix-guard-inuse`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  expect(response.status).toBe(409);
  expect(response.body).toMatchObject({ userCount: 1 });
});

test("POST /api/roles with an unknown permission → 400, and no role row appears", async () => {
  const response = await api("/api/roles", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Matrix Badperms", permissions: ["nonsense.view"] },
  });
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({ invalidPermissions: ["nonsense.view"] });
  // A 400 never mutates: validation completes before any INSERT runs.
  const { rows } = await getPool().query(`SELECT key FROM roles WHERE key = 'matrix-badperms'`);
  expect(rows).toHaveLength(0);
});

test("POST /api/users with an unknown role → 400 Unknown role", async () => {
  const response = await api("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Matrix Nope",
      email: "nope@matrix.test",
      password: FIXTURE_PASSWORD,
      role: "Nope",
    },
  });
  expect(response.status).toBe(400);
  expect(response.body).toMatchObject({ error: "Unknown role" });
});

test("deputy: grants replaced AFTER login resolve on the deputy's next request", async () => {
  // The reachable face of the last-holder guard: matrix-deputy holds
  // roles.manage with an attached user, and Admin strips it to exactly
  // ["roles.view"] — the deputy's NEXT request (same login, no re-login)
  // resolves the CURRENT grants via the fresh roles JOIN in getSessionUser.
  const created = await api("/api/roles", {
    method: "POST",
    cookie: adminCookie,
    body: { name: "Matrix Deputy", permissions: ["roles.manage", "roles.view"] },
  });
  expect(created.status).toBe(201);
  const deputyUser = await api("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Matrix Deputy User",
      email: "deputy@matrix.test",
      password: FIXTURE_PASSWORD,
      role: "matrix-deputy",
    },
  });
  expect(deputyUser.status).toBe(201);

  const deputyCookie = await login("deputy@matrix.test", FIXTURE_PASSWORD);

  // Before the strip: the deputy's grants include roles.manage, so a guarded
  // mutation succeeds through the same cookie.
  const before = await api("/api/roles", {
    method: "POST",
    cookie: deputyCookie,
    body: { name: "Matrix Deputy Before" },
  });
  expect(before.status).toBe(201);

  const strip = await api(`/api/roles/matrix-deputy/permissions`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { permissions: ["roles.view"] },
  });
  expect(strip.status).toBe(200);
  const audit = await auditRows("matrix-deputy", "role.permissions.replaced");
  expect(audit).toHaveLength(1);
  expect(audit[0].actor_id).toBe(await userIdByEmail(FIXTURE_EMAILS.admin));
  expect(audit[0].diff).toEqual({
    before: ["roles.manage", "roles.view"],
    after: ["roles.view"],
  });

  // After the strip — SAME cookie, no re-login: the fresh grants bind. The
  // kept roles.view still answers (GET stays 200), while the lost
  // roles.manage is now a 403 — the observable resolution change.
  const listAfter = await api("/api/roles", { cookie: deputyCookie });
  expect(listAfter.status).toBe(200);
  const manageAfter = await api("/api/roles", {
    method: "POST",
    cookie: deputyCookie,
    body: { name: "Matrix Deputy After" },
  });
  expect(manageAfter.status).toBe(403);
  expect(manageAfter.body).toEqual({ error: "Forbidden", requiredPermission: "roles.manage" });
});

test("users.role FK: a pg INSERT with a non-existent role is rejected (SQLSTATE 23503)", async () => {
  const rejection = await getPool()
    .query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'NoSuchRole')`,
      ["Matrix Fk User", "matrix-fk@matrix.test", "not-a-real-hash"],
    )
    .then(
      () => null,
      (error: { code?: string }) => error,
    );
  expect(rejection).not.toBeNull();
  expect(rejection?.code).toBe("23503");
  const { rows } = await getPool().query(`SELECT id FROM users WHERE email = 'matrix-fk@matrix.test'`);
  expect(rows).toHaveLength(0);
});

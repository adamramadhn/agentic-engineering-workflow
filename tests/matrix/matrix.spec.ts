import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import {
  api,
  auditCount,
  auditRows,
  cleanupMatrixRoles,
  cleanupMatrixUsers,
  closeDbPool,
  FIXTURE_EMAILS,
  FIXTURE_PASSWORD,
  login,
  seedFixtureUsers,
  userIdByEmail,
  type ApiResult,
} from "./helpers";

/**
 * The per-role status matrix (epic 3 story 2) — the endpoint inventory's
 * per-role table over real HTTP, plus the 401 row set (all 7 routes,
 * unauthenticated). matrix-custom, a suite-created role holding exactly
 * ["roles.view"], is created THROUGH the API in beforeAll: the POST itself is
 * asserted (201 + its audit row + the server-derived key), and its fixture
 * user (POST /api/users) doubles as the users-create-writes-no-audit proof.
 */

const CUSTOM_ROLE_KEY = "matrix-custom";
const CUSTOM_ROLE_NAME = "Matrix Custom";
const CUSTOM_USER_EMAIL = "custom@matrix.test";

type FixtureId = "admin" | "editor" | "member" | "custom";
const FIXTURE_IDS: readonly FixtureId[] = ["admin", "editor", "member", "custom"];

const FIXTURE_LOGIN: Record<FixtureId, string> = {
  admin: FIXTURE_EMAILS.admin,
  editor: FIXTURE_EMAILS.editor,
  member: FIXTURE_EMAILS.member,
  custom: CUSTOM_USER_EMAIL,
};

interface OpCase {
  /** Inventory row # — the endpoint inventory is the suite's contract. */
  id: number;
  label: string;
  /** The requirePermission key guarding the route — pinned by the 403 body. */
  guard: string;
  /** Seed grants decide the row: Admin ["*"]; Editor workspace+users
   *  create/update; Member workspace view; matrix-custom ["roles.view"]. */
  expected: Record<FixtureId, number>;
  run: (fixture: FixtureId, cookie: string) => Promise<ApiResult>;
  /** Light body assertions, only on the rows expecting the success status. */
  checkSuccess?: (response: ApiResult, fixture: FixtureId) => void;
}

const OPS: readonly OpCase[] = [
  {
    id: 1,
    label: "GET /api/users (users.view)",
    guard: "users.view",
    expected: { admin: 200, editor: 200, member: 403, custom: 403 },
    run: (_fixture, cookie) => api("/api/users", { cookie }),
    checkSuccess: (response) => {
      expect(Array.isArray((response.body as { users?: unknown }).users)).toBe(true);
    },
  },
  {
    id: 2,
    label: "POST /api/users (users.create)",
    guard: "users.create",
    expected: { admin: 201, editor: 201, member: 403, custom: 403 },
    run: (fixture, cookie) =>
      api("/api/users", {
        method: "POST",
        cookie,
        body: {
          name: `Matrix Op2 ${fixture}`,
          email: `matrix-op2-${fixture}@matrix.test`,
          password: FIXTURE_PASSWORD,
          role: "Member",
        },
      }),
    checkSuccess: (response, fixture) => {
      expect(response.body).toMatchObject({
        user: { email: `matrix-op2-${fixture}@matrix.test`, role: "Member" },
      });
    },
  },
  {
    id: 3,
    label: "GET /api/roles (roles.view)",
    guard: "roles.view",
    expected: { admin: 200, editor: 403, member: 403, custom: 200 },
    run: (_fixture, cookie) => api("/api/roles", { cookie }),
    checkSuccess: (response) => {
      const roles = (response.body as { roles?: Array<{ key: string; userCount?: number }> })
        .roles;
      expect(Array.isArray(roles)).toBe(true);
      // matrix-custom carries its fixture user — the LEFT JOIN count shows 1.
      expect(roles?.find((role) => role.key === CUSTOM_ROLE_KEY)?.userCount).toBe(1);
    },
  },
  {
    id: 4,
    label: "POST /api/roles (roles.manage)",
    guard: "roles.manage",
    expected: { admin: 201, editor: 403, member: 403, custom: 403 },
    run: (fixture, cookie) =>
      api("/api/roles", {
        method: "POST",
        cookie,
        body: { name: `Matrix Opfour ${fixture}` },
      }),
    checkSuccess: (response, fixture) => {
      // The key is server-derived from the slugified name, never client-set.
      expect(response.body).toMatchObject({
        role: { key: `matrix-opfour-${fixture}`, permissions: [], isSystem: false },
      });
    },
  },
  {
    id: 5,
    label: "PATCH /api/roles/[key] (roles.manage)",
    guard: "roles.manage",
    expected: { admin: 200, editor: 403, member: 403, custom: 403 },
    run: (_fixture, cookie) =>
      api(`/api/roles/${CUSTOM_ROLE_KEY}`, {
        method: "PATCH",
        cookie,
        body: { name: CUSTOM_ROLE_NAME },
      }),
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({
        role: { key: CUSTOM_ROLE_KEY, name: CUSTOM_ROLE_NAME },
      });
    },
  },
  {
    id: 6,
    label: "DELETE /api/roles/[key] (roles.manage)",
    guard: "roles.manage",
    expected: { admin: 200, editor: 403, member: 403, custom: 403 },
    run: async (fixture, cookie) => {
      if (fixture !== "admin") {
        // matrix-custom has its fixture user attached, but the guard fires
        // long before the in-use check — a 403 has no side effects.
        return api(`/api/roles/${CUSTOM_ROLE_KEY}`, { method: "DELETE", cookie });
      }
      // The 200 row needs a deletable target: matrix-custom is in use, so the
      // admin deletes a dedicated throwaway role instead.
      const created = await api("/api/roles", {
        method: "POST",
        cookie,
        body: { name: `Matrix Opsix ${fixture}` },
      });
      expect(created.status).toBe(201);
      return api(`/api/roles/matrix-opsix-${fixture}`, { method: "DELETE", cookie });
    },
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({ deleted: true });
    },
  },
  {
    id: 7,
    label: "PATCH /api/roles/[key]/permissions (roles.manage)",
    guard: "roles.manage",
    expected: { admin: 200, editor: 403, member: 403, custom: 403 },
    run: (_fixture, cookie) =>
      api(`/api/roles/${CUSTOM_ROLE_KEY}/permissions`, {
        method: "PATCH",
        cookie,
        body: { permissions: ["roles.view"] },
      }),
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({
        role: { key: CUSTOM_ROLE_KEY, permissions: ["roles.view"], resolvedPermissions: ["roles.view"] },
      });
    },
  },
];

const cookies: Partial<Record<FixtureId, string>> = {};

beforeAll(async () => {
  await seedFixtureUsers();
  const adminCookie = await login(FIXTURE_EMAILS.admin, FIXTURE_PASSWORD);

  // matrix-custom is created through the API — the POST + its audit row are
  // part of the proof, not just setup.
  const created = await api("/api/roles", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: CUSTOM_ROLE_NAME,
      description: "suite-created fixture: exactly roles.view",
      permissions: ["roles.view"],
    },
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    role: { key: CUSTOM_ROLE_KEY, permissions: ["roles.view"], isSystem: false, userCount: 0 },
  });

  const adminId = await userIdByEmail(FIXTURE_EMAILS.admin);
  const createdAudit = await auditRows(CUSTOM_ROLE_KEY, "role.created");
  expect(createdAudit).toHaveLength(1);
  expect(createdAudit[0].actor_id).toBe(adminId);
  expect(createdAudit[0].diff).toEqual({ name: CUSTOM_ROLE_NAME, permissions: ["roles.view"] });

  // Its fixture user (the custom row's login). POST /api/users succeeds here —
  // and must write ZERO audit rows: audit is a roles-mutation concern only.
  const auditBefore = await auditCount(CUSTOM_ROLE_KEY);
  const user = await api("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Matrix Custom User",
      email: CUSTOM_USER_EMAIL,
      password: FIXTURE_PASSWORD,
      role: CUSTOM_ROLE_KEY,
    },
  });
  expect(user.status).toBe(201);
  expect(await auditCount(CUSTOM_ROLE_KEY)).toBe(auditBefore);

  for (const fixture of FIXTURE_IDS) {
    cookies[fixture] = await login(FIXTURE_LOGIN[fixture], FIXTURE_PASSWORD);
  }
});

afterEach(async () => {
  // Per-test artifacts only (ops 2/4/6). The fixture users and matrix-custom
  // survive until afterAll — later tests still log in with them.
  await cleanupMatrixUsers({ keep: [...Object.values(FIXTURE_EMAILS), CUSTOM_USER_EMAIL] });
  await cleanupMatrixRoles("matrix-op");
});

afterAll(async () => {
  await cleanupMatrixUsers({ keep: [] });
  await cleanupMatrixRoles();
  await closeDbPool();
});

for (const fixture of FIXTURE_IDS) {
  for (const op of OPS) {
    test(`op${op.id} ${op.label} as ${fixture} → ${op.expected[fixture]}`, async () => {
      const cookie = cookies[fixture];
      if (!cookie) throw new Error(`no login cookie for fixture ${fixture}`);
      const response = await op.run(fixture, cookie);
      const expected = op.expected[fixture];
      expect(response.status).toBe(expected);
      if (expected === 403) {
        expect(response.body).toEqual({ error: "Forbidden", requiredPermission: op.guard });
      } else if (op.checkSuccess) {
        await op.checkSuccess(response, fixture);
      }
    });
  }
}

// The 401 row set: every inventory route, unauthenticated, same pinned body.
const UNAUTH_CALLS: ReadonlyArray<[string, () => Promise<ApiResult>]> = [
  ["GET /api/users", () => api("/api/users")],
  [
    "POST /api/users",
    () =>
      api("/api/users", {
        method: "POST",
        body: {
          name: "Matrix Unauth",
          email: "matrix-unauth@matrix.test",
          password: FIXTURE_PASSWORD,
          role: "Member",
        },
      }),
  ],
  ["GET /api/roles", () => api("/api/roles")],
  ["POST /api/roles", () => api("/api/roles", { method: "POST", body: { name: "Matrix Unauth Four" } })],
  [
    "PATCH /api/roles/[key]",
    () => api(`/api/roles/${CUSTOM_ROLE_KEY}`, { method: "PATCH", body: { name: "Matrix Unauth" } }),
  ],
  ["DELETE /api/roles/[key]", () => api(`/api/roles/${CUSTOM_ROLE_KEY}`, { method: "DELETE" })],
  [
    "PATCH /api/roles/[key]/permissions",
    () =>
      api(`/api/roles/${CUSTOM_ROLE_KEY}/permissions`, {
        method: "PATCH",
        body: { permissions: ["roles.view"] },
      }),
  ],
];

for (const [label, call] of UNAUTH_CALLS) {
  test(`unauthenticated ${label} → 401`, async () => {
    const response = await call();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Not authenticated" });
  });
}

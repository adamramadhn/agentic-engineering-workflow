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
} from "./helpers";

/**
 * One role_audit row per successful roles mutation — count, actor_id, and diff
 * shape for each of the four actions — read over pg from the scratch database.
 * Plus the negative: a successful users-create writes zero audit rows.
 */

let adminCookie: string;
let adminId: string;

async function createRole(
  name: string,
  options: { description?: string; permissions?: string[] } = {},
): Promise<void> {
  const response = await api("/api/roles", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name,
      description: options.description,
      permissions: options.permissions,
    },
  });
  expect(response.status).toBe(201);
}

beforeAll(async () => {
  await seedFixtureUsers();
  adminCookie = await login(FIXTURE_EMAILS.admin, FIXTURE_PASSWORD);
  adminId = await userIdByEmail(FIXTURE_EMAILS.admin);
});

afterEach(async () => {
  await cleanupMatrixUsers();
  await cleanupMatrixRoles("matrix-audit");
});

afterAll(async () => {
  await cleanupMatrixUsers({ keep: [] });
  await cleanupMatrixRoles();
  await closeDbPool();
});

test("role.created: exactly one row, actor = caller, diff {name, permissions}", async () => {
  await createRole("Matrix Audit Created", { permissions: ["roles.view"] });
  const rows = await auditRows("matrix-audit-created");
  expect(rows).toHaveLength(1);
  expect(rows[0].action).toBe("role.created");
  expect(rows[0].actor_id).toBe(adminId);
  expect(rows[0].diff).toEqual({ name: "Matrix Audit Created", permissions: ["roles.view"] });
});

test("role.updated: exactly one row, before/after name + description", async () => {
  await createRole("Matrix Audit Updated", { description: "before" });
  const patched = await api(`/api/roles/matrix-audit-updated`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { name: "Matrix Audit Updated Renamed", description: "after" },
  });
  expect(patched.status).toBe(200);
  const rows = await auditRows("matrix-audit-updated", "role.updated");
  expect(rows).toHaveLength(1);
  expect(rows[0].actor_id).toBe(adminId);
  expect(rows[0].diff).toEqual({
    before: { name: "Matrix Audit Updated", description: "before" },
    after: { name: "Matrix Audit Updated Renamed", description: "after" },
  });
});

test("role.deleted: exactly one row, diff {name}", async () => {
  await createRole("Matrix Audit Deleted");
  const deleted = await api(`/api/roles/matrix-audit-deleted`, {
    method: "DELETE",
    cookie: adminCookie,
  });
  expect(deleted.status).toBe(200);
  // role_key is a raw string, not an FK — the row outlives the role.
  const rows = await auditRows("matrix-audit-deleted", "role.deleted");
  expect(rows).toHaveLength(1);
  expect(rows[0].actor_id).toBe(adminId);
  expect(rows[0].diff).toEqual({ name: "Matrix Audit Deleted" });
});

test("role.permissions.replaced: exactly one row, diff {before, after}", async () => {
  await createRole("Matrix Audit Replaced", { permissions: ["roles.view"] });
  const replaced = await api(`/api/roles/matrix-audit-replaced/permissions`, {
    method: "PATCH",
    cookie: adminCookie,
    body: { permissions: ["roles.manage"] },
  });
  expect(replaced.status).toBe(200);
  const rows = await auditRows("matrix-audit-replaced", "role.permissions.replaced");
  expect(rows).toHaveLength(1);
  expect(rows[0].actor_id).toBe(adminId);
  expect(rows[0].diff).toEqual({ before: ["roles.view"], after: ["roles.manage"] });
});

test("POST /api/users (success) writes zero role_audit rows", async () => {
  // Audit is a roles-mutation concern only. Scoped by the created user's role
  // key: no spec mutates Member, so any new row could only be this create's.
  const before = await auditCount("Member");
  const created = await api("/api/users", {
    method: "POST",
    cookie: adminCookie,
    body: {
      name: "Matrix Audit User",
      email: "matrix-audit-user@matrix.test",
      password: FIXTURE_PASSWORD,
      role: "Member",
    },
  });
  expect(created.status).toBe(201);
  expect(await auditCount("Member")).toBe(before);
});

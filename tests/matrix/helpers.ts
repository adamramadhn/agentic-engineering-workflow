import bcrypt from "bcryptjs";
import pg, { type Pool } from "pg";
import { ACCESS_COOKIE } from "@/lib/auth-constants";

/**
 * Shared fixtures + transport for the matrix specs. Every API assertion goes
 * through api() — a real fetch against the app global-setup booted, login
 * cookies replayed as a Cookie header — and every DB read goes through the pg
 * pool bound to the scratch database URL (MATRIX_DB_URL), never the dev DB.
 */

function baseUrl(): string {
  const url = process.env.MATRIX_BASE_URL;
  if (!url) {
    throw new Error(
      "MATRIX_BASE_URL is not set — the matrix global setup did not run (use `npm run test:matrix`)",
    );
  }
  return url;
}

let pool: Pool | null = null;

export function getPool(): Pool {
  const url = process.env.MATRIX_DB_URL;
  if (!url) {
    throw new Error(
      "MATRIX_DB_URL is not set — the matrix global setup did not run (use `npm run test:matrix`)",
    );
  }
  if (!pool) {
    // max: 1 — the specs' seeds/audit reads are strictly sequential, and a
    // single connection tears down cleanly in afterAll.
    pool = new pg.Pool({ connectionString: url, max: 1 });
  }
  return pool;
}

export async function closeDbPool(): Promise<void> {
  const closing = pool;
  pool = null;
  if (closing) {
    await closing.end().catch(() => {});
  }
}

export interface ApiResult {
  status: number;
  body: unknown;
}

/** Real-HTTP wrapper: fetch against the booted app, JSON in/out. */
export async function api(
  path: string,
  options: { method?: string; body?: unknown; cookie?: string } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.cookie !== undefined) headers["Cookie"] = options.cookie;
  const response = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: response.status, body };
}

/**
 * Login through the real endpoint and capture the access-cookie pair
 * (`onyx_access=<jwt>`) from the response's set-cookie — exactly the string a
 * browser would send back, which api() replays as the Cookie header.
 */
export async function login(email: string, password: string): Promise<string> {
  const response = await fetch(`${baseUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (response.status !== 200) {
    throw new Error(`login failed for ${email}: HTTP ${response.status}`);
  }
  const access = response.headers
    .getSetCookie()
    .find((cookie: string) => cookie.startsWith(`${ACCESS_COOKIE}=`));
  if (!access) {
    throw new Error(`login for ${email} set no ${ACCESS_COOKIE} cookie`);
  }
  return access.split(";")[0];
}

export const FIXTURE_PASSWORD = "matrix-fixture-pass";

export interface FixtureUser {
  name: string;
  email: string;
  role: string;
}

/**
 * The three seeded-role users, pg-inserted with the app's own bcrypt cost (10)
 * so login goes through the real endpoint. pg-seeding (instead of an HTTP
 * register chain) avoids the chicken-and-egg of needing an admin to create the
 * admin; the roles themselves are the schema seed's, untouched.
 */
export const FIXTURE_USERS: readonly FixtureUser[] = [
  { name: "Matrix Admin", email: "admin@matrix.test", role: "Admin" },
  { name: "Matrix Editor", email: "editor@matrix.test", role: "Editor" },
  { name: "Matrix Member", email: "member@matrix.test", role: "Member" },
];

export const FIXTURE_EMAILS = {
  admin: "admin@matrix.test",
  editor: "editor@matrix.test",
  member: "member@matrix.test",
} as const;

/** Idempotent (ON CONFLICT DO NOTHING) — safe to call from every spec file. */
export async function seedFixtureUsers(): Promise<void> {
  for (const user of FIXTURE_USERS) {
    const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 10);
    await getPool().query(
      `INSERT INTO users (name, email, password_hash, role, team, status)
       VALUES ($1, $2, $3, $4, 'General', 'Active')
       ON CONFLICT (email) DO NOTHING`,
      [user.name, user.email, passwordHash, user.role],
    );
  }
}

export async function userIdByEmail(email: string): Promise<string> {
  const result = await getPool().query<{ id: string }>(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error(`no users row for ${email}`);
  return id;
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  role_key: string;
  diff: unknown;
  created_at: Date;
}

/** Audit rows for one role key (optionally one action), oldest first. */
export async function auditRows(roleKey: string, action?: string): Promise<AuditRow[]> {
  const result = await getPool().query<AuditRow>(
    `SELECT id, actor_id, action, role_key, diff, created_at
     FROM role_audit
     WHERE role_key = $1${action ? " AND action = $2" : ""}
     ORDER BY created_at ASC, id ASC`,
    action ? [roleKey, action] : [roleKey],
  );
  return result.rows;
}

export async function auditCount(roleKey: string, action?: string): Promise<number> {
  const result = await getPool().query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM role_audit
     WHERE role_key = $1${action ? " AND action = $2" : ""}`,
    action ? [roleKey, action] : [roleKey],
  );
  return Number(result.rows[0]?.count ?? 0);
}

/**
 * Delete every @matrix.test user except `keep` (default: the seeded fixture
 * users, so per-test cleanups do not invalidate later logins). MUST run before
 * role cleanup — users.role references roles (users_role_fkey).
 * refresh_tokens cascade with the user; role_audit.actor_id is SET NULL (audit
 * rows outlive actors by design).
 */
export async function cleanupMatrixUsers(options: { keep?: readonly string[] } = {}): Promise<void> {
  const keep = options.keep ?? FIXTURE_USERS.map((user) => user.email);
  await getPool().query(
    `DELETE FROM users WHERE email LIKE '%@matrix.test' AND NOT (email = ANY($1))`,
    [keep],
  );
}

/**
 * Delete roles whose key starts with `keyPrefix` (default: the whole matrix-
 * namespace). Only callable after the users holding them are gone.
 */
export async function cleanupMatrixRoles(keyPrefix = "matrix-"): Promise<void> {
  await getPool().query(`DELETE FROM roles WHERE key LIKE $1`, [`${keyPrefix}%`]);
}

import { createHash, randomUUID } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { query } from "./db";
import { resolvePermissions } from "./permissions";
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from "./auth-constants";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeTokenClaims,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./jwt";

export { ACCESS_COOKIE, REFRESH_COOKIE };

const BCRYPT_COST = 10;

/**
 * Hash of an unusable password. When the login email is unknown we still run a
 * bcrypt compare against this so the response time matches the known-email path
 * (timing-safe: the compare always runs).
 */
const DUMMY_PASSWORD_HASH = "$2b$10$EfndwALvIchoLsymaCqOi.xGn9OQ5WnzJE6aYkIu/ipBDbvT9DzZK";

/** Grace window for concurrent refresh races (two tabs). Expressed in SQL as `interval '30 seconds'`. */
export const REFRESH_GRACE_WINDOW_SECONDS = 30;

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/** bcrypt hash (cost 10) — pure JS, no native build step. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return bcrypt.compare(password, stored);
}

/** Burn the same bcrypt time as a real login when the email is unknown. */
export async function verifyDummyPassword(password: string): Promise<boolean> {
  return bcrypt.compare(password, DUMMY_PASSWORD_HASH);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: string;
  createdAt: string;
  /** Resolved + expanded via resolvePermissions() — concrete catalog keys only. */
  permissions: string[];
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  team: string;
  status: string;
  created_at: Date;
  /**
   * Raw role grants from the roles join — pg delivers JSONB already parsed as a
   * JS value. Optional: rows from queries without the roles join resolve to a
   * deny-all `[]`. Values other than strings (bad JSONB) are filtered out.
   */
  role_permissions?: unknown;
}

export function toSessionUser(row: UserRow): SessionUser {
  const granted = Array.isArray(row.role_permissions)
    ? row.role_permissions.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    team: row.team,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    permissions: resolvePermissions(granted),
  };
}

async function loadUserByIdRow(id: string): Promise<UserRow | null> {
  // COALESCE keeps a user whose role row is missing at [] = deny-all (cheap
  // insurance; after schema v3 the users_role_fkey makes it unreachable).
  const result = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.team, u.status, u.created_at,
            COALESCE(r.permissions, '[]'::jsonb) AS role_permissions
     FROM users u LEFT JOIN roles r ON r.key = u.role
     WHERE u.id = $1`,
    [id]
  );
  return result.rows[0] ?? null;
}

/** Load a user by id for token issuance. Status is deliberately not filtered here — non-Active users are cut off at rotation (see rotateRefreshToken). */
export async function loadUserById(id: string): Promise<SessionUser | null> {
  const row = await loadUserByIdRow(id);
  return row ? toSessionUser(row) : null;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function shortHash(hash: string): string {
  return hash.slice(0, 12);
}

/**
 * Sign an access (15m) + refresh (7d) pair, persist the refresh token as
 * sha256(jti), and set both httpOnly cookies.
 *
 * The access cookie's `maxAge` intentionally equals REFRESH_TOKEN_TTL_SECONDS,
 * NOT the access token's TTL: the cookie must outlive its JWT so that a user
 * idle for >15 minutes still reaches the app with an expired-but-signed access
 * token. The proxy then serves the page shell and the client silently
 * refreshes. `exp` is always re-verified server-side, so the longer cookie
 * grants nothing on its own.
 */
export async function issueTokenPair(user: SessionUser): Promise<void> {
  const jti = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user.id, jti),
  ]);

  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, sha256(jti), new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)]
  );

  const cookieStore = await cookies();
  const shared = {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction(),
  } as const;
  cookieStore.set(ACCESS_COOKIE, accessToken, {
    ...shared,
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    ...shared,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });
}

/**
 * Remove both auth cookies (used on every refresh failure and on logout).
 *
 * Each delete must repeat the cookie's original `path`: a pathless Set-Cookie is
 * scoped by the browser to the *request* path (/api/auth/...), which would never
 * evict the access cookie that was set on `/`.
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete({ name: ACCESS_COOKIE, path: "/" });
  cookieStore.delete({ name: REFRESH_COOKIE, path: REFRESH_COOKIE_PATH });
}

/** Revoke every live refresh token of a user (family revoke after detected reuse, or when the account is not Active). */
export async function revokeAllUserTokens(
  userId: string,
  reason: "reuse" | "deactivated" = "reuse"
): Promise<void> {
  await query(
    `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = $2
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId, reason]
  );
}

/** Revoke the refresh token currently held by the client (explicit logout). */
export async function revokeRefreshTokenOnLogout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!token) return;
  // Unverified decode on purpose: logout must still revoke the DB row of an
  // expired token, and the extracted jti only ever matches a row we created.
  const claims = decodeTokenClaims(token);
  if (!claims?.jti || claims.type !== "refresh") return;
  await query(
    `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'logout'
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [sha256(claims.jti)]
  );
}

export type RefreshOutcome =
  | { status: "ok"; user: SessionUser }
  | { status: "unauthorized" };

/**
 * Rotate the refresh token from the request cookie.
 *
 * Claiming is atomic — one `UPDATE … WHERE revoked_at IS NULL RETURNING` — so
 * two tabs refreshing concurrently cannot both win the token or falsely trip
 * reuse detection. The loser is classified by *why* the token was revoked:
 *
 *   'rotated' within 30s  → concurrent race: issue a fresh pair (no family revoke)
 *   'rotated' after 30s   → replay of an old token: revoke the whole family
 *   'logout' / 'reuse'    → replay of a revoked session: 401, no grace, no re-issue
 *
 * Clock discipline: `revoked_at` is written by Postgres, so the 30s grace delta
 * is computed in SQL (`now() - revoked_at`). `expires_at` is written by Node, so
 * it is compared against `Date.now()`. The two clocks are never mixed.
 */
export async function rotateRefreshToken(): Promise<RefreshOutcome> {
  const cookieStore = await cookies();
  const token = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!token) return { status: "unauthorized" };

  const claims = await verifyRefreshToken(token);
  if (!claims) return { status: "unauthorized" };

  const hash = sha256(claims.jti);

  // ONE statement: claim & revoke atomically, recording why. rowCount === 1 → winner.
  // expires_at is passed as a parameter (Node clock) because Node wrote that
  // column; the revoked_at writes below stay on the Postgres clock.
  const claimed = await query<{ id: string; user_id: string }>(
    `UPDATE refresh_tokens SET revoked_at = now(), revoked_reason = 'rotated'
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > $2
     RETURNING id, user_id`,
    [hash, new Date(Date.now())]
  );

  if (claimed.rowCount === 1) {
    const user = await loadUserById(claims.sub);
    if (!user || user.status !== "Active") {
      await revokeAllUserTokens(claims.sub, "deactivated");
      return { status: "unauthorized" };
    }
    await issueTokenPair(user);
    return { status: "ok", user };
  }

  // Lost the claim: decide by revocation reason. Grace delta is computed on the
  // Postgres clock, the same clock that wrote revoked_at.
  const rows = await query<{
    user_id: string;
    expires_at: Date;
    revoked_at: Date | null;
    revoked_reason: string | null;
    // NULL when revoked_at is NULL (SQL three-valued logic) — see below.
    grace_eligible: boolean | null;
  }>(
    `SELECT user_id, expires_at, revoked_at, revoked_reason,
            (revoked_reason = 'rotated' AND now() - revoked_at <= interval '30 seconds') AS grace_eligible
     FROM refresh_tokens WHERE token_hash = $1`,
    [hash]
  );
  const row = rows.rows[0];
  if (!row) return { status: "unauthorized" };
  // expires_at was written by the Node clock, so it is compared on the Node clock.
  if (row.expires_at.getTime() <= Date.now()) return { status: "unauthorized" };

  // The row was never revoked, so the claim above could only have failed on
  // expiry — this is a spent token, not a replay of a revoked one.
  if (row.revoked_at === null) {
    console.warn(
      JSON.stringify({
        event: "refresh_token_expired",
        userId: row.user_id,
        tokenHashPrefix: shortHash(hash),
      })
    );
    return { status: "unauthorized" };
  }

  if (row.grace_eligible) {
    const user = await loadUserById(claims.sub);
    if (!user || user.status !== "Active") {
      await revokeAllUserTokens(row.user_id, "deactivated");
      return { status: "unauthorized" };
    }
    console.warn(
      JSON.stringify({
        event: "refresh_grace_issued",
        reason: "concurrent_refresh_race",
        userId: row.user_id,
        tokenHashPrefix: shortHash(hash),
        graceWindowSeconds: REFRESH_GRACE_WINDOW_SECONDS,
      })
    );
    await issueTokenPair(user);
    return { status: "ok", user };
  }

  if (row.revoked_reason === "rotated") {
    // Replay of a token rotated more than a grace window ago → reuse detection.
    console.warn(
      JSON.stringify({
        event: "refresh_reuse_detected",
        reason: "rotated_token_replayed_after_grace",
        userId: row.user_id,
        tokenHashPrefix: shortHash(hash),
      })
    );
    await revokeAllUserTokens(row.user_id, "reuse");
    return { status: "unauthorized" };
  }

  // Replay of a 'logout'/'reuse' token: no grace, no re-issue, no extra family revoke.
  if (row.revoked_reason !== null) {
    console.warn(
      JSON.stringify({
        event: "refresh_revoked_token_replayed",
        reason: row.revoked_reason,
        userId: row.user_id,
        tokenHashPrefix: shortHash(hash),
      })
    );
    return { status: "unauthorized" };
  }

  // Revoked before revoked_reason existed (legacy row) — deny without guessing.
  console.warn(
    JSON.stringify({
      event: "refresh_token_unknown_reason",
      userId: row.user_id,
      tokenHashPrefix: shortHash(hash),
    })
  );
  return { status: "unauthorized" };
}

/**
 * Resolve the signed-in user from the access JWT cookie.
 *
 * Strict verification (signature + exp) — unlike the proxy, which only routes.
 * A user whose status changed after issuance may keep ≤15 minutes of access
 * until the token expires; without a token denylist an issued access token
 * cannot be recalled (accepted limitation, parity with the baseline).
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;

  const claims = await verifyAccessToken(token);
  if (!claims) return null;

  const row = await loadUserByIdRow(claims.sub);
  return row ? toSessionUser(row) : null;
}

/** Basic email shape validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

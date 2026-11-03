import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { query } from "./db";
import { SESSION_COOKIE } from "./auth-constants";

export { SESSION_COOKIE };
const SESSION_TTL_DAYS = 30;

/**
 * Password hashing with Node's built-in scrypt — no extra dependencies.
 * Stored format: scrypt$<salt hex>$<hash hex>
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(actual, expected);
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: string;
  team: string;
  status: string;
  createdAt: string;
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
}

export function toSessionUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    team: row.team,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

/** Create a DB-backed session and set the httpOnly cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  );
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

/** Delete the current session (DB + cookie). */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`DELETE FROM sessions WHERE token = $1`, [token]);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Resolve the signed-in user from the session cookie, or null. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const result = await query<UserRow>(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.team, u.status, u.created_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > now()`,
    [token]
  );
  const row = result.rows[0];
  return row ? toSessionUser(row) : null;
}

/** Generate a new user id. */
export function newUserId(): string {
  return `usr_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Basic email shape validation. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

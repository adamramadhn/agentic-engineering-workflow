import { Pool, type QueryResult, type QueryResultRow } from "pg";

/**
 * Shared PostgreSQL connection pool.
 * DATABASE_URL is defined in .env.local (gitignored).
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Add it to .env.local");
}

export const pool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

/**
 * Idempotent schema bootstrap (schema v2). Runs once per server process before
 * the first query so the app works against a fresh database without a separate
 * migration step.
 *
 * v2 replaces the legacy opaque-session design:
 *   users          id is a native UUID (gen_random_uuid()) instead of TEXT `usr_*`
 *   refresh_tokens JWT refresh material, stored as sha256(jti), rotatable/revocable
 *   sessions       dropped — sessions are now stateless JWT access tokens
 */
let schemaReady: Promise<void> | null = null;

async function migrateLegacySchema(): Promise<void> {
  // A v1 database has users.id as TEXT (`usr_*` opaque ids). Detect it by column
  // type (lowercased — information_schema reports in lower case already, but be
  // explicit) and drop the legacy tables: ids are incompatible with v2 UUIDs and
  // the plan explicitly does not carry old data (scrypt hashes are dead too).
  const idType = await pool.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'`
  );
  const isLegacy = idType.rows[0]?.data_type?.toLowerCase() === "text";

  // The sessions table belongs to the dropped design; remove it whenever found.
  await pool.query(`DROP TABLE IF EXISTS sessions`);

  if (isLegacy) {
    console.warn("[db] legacy TEXT-id users table detected — dropping users (old data is not migrated)");
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
  }
}

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await migrateLegacySchema();

      // gen_random_uuid() is built into Postgres 13+; the extension attempt is a
      // no-op there and a best-effort fallback for older instances.
      try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
      } catch {
        // Ignore: extension may require privileges the app user lacks.
      }

      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Member',
          team TEXT NOT NULL DEFAULT 'General',
          status TEXT NOT NULL DEFAULT 'Active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ,
          revoked_reason TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
        -- Existing v2 databases were created before revoked_reason existed.
        ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
      `);
    })().catch((error) => {
      // Allow a later request to retry if bootstrap failed (e.g. DB was down)
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  await ensureSchema();
  const result = await pool.query(text, params);
  return result as QueryResult<T>;
}

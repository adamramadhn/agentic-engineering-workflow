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
 * Idempotent schema bootstrap. Runs once per server process before the
 * first query so the app works against a fresh database without a
 * separate migration step.
 */
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'Member',
          team TEXT NOT NULL DEFAULT 'General',
          status TEXT NOT NULL DEFAULT 'Active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          expires_at TIMESTAMPTZ NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
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

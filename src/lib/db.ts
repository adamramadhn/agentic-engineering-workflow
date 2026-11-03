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
 * Idempotent schema bootstrap (schema v3). Runs once per server process before
 * the first query so the app works against a fresh database without a separate
 * migration step.
 *
 * v2 replaces the legacy opaque-session design:
 *   users          id is a native UUID (gen_random_uuid()) instead of TEXT `usr_*`
 *   refresh_tokens JWT refresh material, stored as sha256(jti), rotatable/revocable
 *   sessions       dropped — sessions are now stateless JWT access tokens
 *
 * v3 adds RBAC:
 *   roles          role key → JSONB permission grants (the only permission data in the DB)
 *   role_audit     audit trail for every roles/permissions mutation
 *   users.role     becomes a real FK to roles(key) — in-place upgrade, zero data
 *                  migration (the seed reuses the exact values users.role already holds)
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

      // ---- Schema v3: RBAC (roles, audit, FK) -------------------------------
      // Ordering matters: roles must exist AND be seeded before the FK is added,
      // because existing users.role rows must all satisfy the constraint. Every
      // value ever writable through the app is exactly Admin/Editor/Member, and
      // the seed covers those — so no UPDATE users statement is needed.
      await pool.query(`
        -- 1. Roles
        CREATE TABLE IF NOT EXISTS roles (
          key         TEXT PRIMARY KEY,
          name        TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          is_system   BOOLEAN NOT NULL DEFAULT false,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 2. Audit trail (tiny, from day 1)
        CREATE TABLE IF NOT EXISTS role_audit (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable: audit outlives actors
          action     TEXT NOT NULL,          -- 'role.created' | 'role.updated' | 'role.deleted' | 'role.permissions.replaced'
          role_key   TEXT NOT NULL,          -- raw key, not an FK: audit rows must survive role deletion
          diff       JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_role_audit_role_key_created ON role_audit(role_key, created_at DESC);

        -- 3. Seed the 3 system roles. Keys MUST be the capitalized literals so existing
        --    users.role rows satisfy the FK below with zero migration.
        --    ON CONFLICT DO NOTHING = seeded once; admin edits to system roles survive restarts.
        INSERT INTO roles (key, name, description, permissions, is_system) VALUES
          ('Admin',  'Admin',  'Full access to every page and action',
            '["*"]'::jsonb, true),
          ('Editor', 'Editor', 'Workspace plus user management, no user deletion',
            '["home.view","ask-ai.view","ask-ai.use","agent-board.view","watching.view",
              "users.view","users.create","users.update"]'::jsonb, true),
          ('Member', 'Member', 'Workspace view access',
            '["home.view","ask-ai.view","ask-ai.use","agent-board.view","watching.view"]'::jsonb, true)
        ON CONFLICT (key) DO NOTHING;

        -- 4. users.role becomes a real FK. Postgres has no ADD CONSTRAINT IF NOT EXISTS,
        --    so guard via pg_constraint in a DO block (idempotent across restarts).
        --    The check is scoped to the users table: a same-named constraint on any
        --    other table must not silently skip adding this FK.
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
             WHERE conname = 'users_role_fkey' AND conrelid = 'users'::regclass
          ) THEN
            ALTER TABLE users ADD CONSTRAINT users_role_fkey
              FOREIGN KEY (role) REFERENCES roles(key);
          END IF;
        END $$;
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

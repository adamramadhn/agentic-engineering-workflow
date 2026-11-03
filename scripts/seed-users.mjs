/**
 * Reseed the demo accounts after the schema-v2 migration.
 *
 * Idempotent: existing emails are left untouched (ON CONFLICT DO NOTHING), so
 * re-running never resets passwords or UUIDs.
 *
 * Usage: node scripts/seed-users.mjs
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

/** Minimal .env.local loader — no dotenv dependency. */
function loadEnvLocal(path = ".env.local") {
  try {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // No .env.local — rely on the real environment.
  }
}

loadEnvLocal(new URL("../.env.local", import.meta.url).pathname);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Add it to .env.local");
  process.exit(1);
}

const BCRYPT_COST = 10;

const DEMO_USERS = [
  { name: "Onyx Admin", email: "admin@onyx.dev", password: "password123", role: "Admin" },
  { name: "Fathur Muhammad", email: "fathur@onyx.dev", password: "password123", role: "Admin" },
  { name: "Sarah Chen", email: "sarah@onyx.dev", password: "rahasia123", role: "Editor" },
];

// Mirrors ensureSchema() in src/lib/db.ts (schema v2) so the script can run
// against a fresh database before the app has ever booted.
async function ensureSchema(pool) {
  const idType = await pool.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'`
  );
  const isLegacy = idType.rows[0]?.data_type?.toLowerCase() === "text";

  await pool.query(`DROP TABLE IF EXISTS sessions`);

  if (isLegacy) {
    console.log("legacy TEXT-id users table detected — dropping (old data is not migrated)");
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
  }

  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  } catch {
    // Ignore: gen_random_uuid() is built into Postgres 13+.
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
    ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS revoked_reason TEXT;
  `);
}

/** Keep the sha256(jti) convention honest by exporting the helper for reference. */
export function tokenHash(jti) {
  return createHash("sha256").update(jti).digest("hex");
}

const pool = new Pool({ connectionString, max: 1 });

try {
  await ensureSchema(pool);

  for (const user of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(user.password, BCRYPT_COST);
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, team, status)
       VALUES ($1, $2, $3, $4, 'General', 'Active')
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [user.name, user.email, passwordHash, user.role]
    );
    if (result.rows.length > 0) {
      console.log(`seeded ${user.email} (${user.role}) -> ${result.rows[0].id}`);
    } else {
      console.log(`kept existing ${user.email}`);
    }
  }

  const total = await pool.query(`SELECT count(*)::int AS count FROM users`);
  console.log(`users in database: ${total.rows[0].count}`);
} catch (error) {
  console.error("seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}

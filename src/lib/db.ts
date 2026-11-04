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
 *
 * v4 adds the Wiki + storage config:
 *   wiki_pages / wiki_labels / wiki_page_labels / wiki_comments / wiki_attachments
 *   wiki_audit    audit trail for every wiki/storage mutation (mirrors role_audit)
 *   app_settings  key → JSONB value store; holds the S3 storage config (the
 *                 requester's explicit "not .env" decision — see the plan)
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
        --    ON CONFLICT DO NOTHING = seeded once; admin edits to system roles survive
        --    restarts — which is also why the v4 wiki keys are appended here for FRESH
        --    databases only: an existing database's Editor/Member rows keep whatever an
        --    admin granted them, and pick wiki up through /permissions. Admin's ["*"]
        --    resolves against the catalog at request time, so it needs no seed change.
        INSERT INTO roles (key, name, description, permissions, is_system) VALUES
          ('Admin',  'Admin',  'Full access to every page and action',
            '["*"]'::jsonb, true),
          ('Editor', 'Editor', 'Workspace plus user management, no user deletion',
            '["home.view","ask-ai.view","ask-ai.use","agent-board.view","wiki.view",
              "wiki.create","wiki.update","wiki.comment","watching.view",
              "users.view","users.create","users.update"]'::jsonb, true),
          ('Member', 'Member', 'Workspace view access',
            '["home.view","ask-ai.view","ask-ai.use","agent-board.view","wiki.view",
              "watching.view"]'::jsonb, true)
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

      // ---- Schema v4: Wiki + storage config ---------------------------------
      // Append-only and idempotent like the blocks above: every statement is
      // CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS, so a v3
      // database upgrades in place and a fresh one arrives at the same shape.
      //
      // FK policy (mirrors the RBAC tables):
      //   page children (labels links, comments, attachments) CASCADE — a page
      //     delete takes its discussion and its metadata with it;
      //   user references SET NULL — pages/comments/audit outlive their authors;
      //   audit `target` is a raw string, never an FK, so the row survives its
      //     subject exactly like role_audit.role_key does.
      await pool.query(`
        -- 1. Generic key → JSONB store. Holds the S3 storage config; the
        --    requester decided credentials live in the database, not .env.
        CREATE TABLE IF NOT EXISTS app_settings (
          key        TEXT PRIMARY KEY,
          value      JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by UUID REFERENCES users(id) ON DELETE SET NULL
        );

        -- 2. Wiki pages. content is the tiptap/ProseMirror document as JSONB.
        CREATE TABLE IF NOT EXISTS wiki_pages (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title      TEXT NOT NULL,
          content    JSONB NOT NULL DEFAULT 'null'::jsonb,
          created_by UUID REFERENCES users(id) ON DELETE SET NULL,
          updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_pages_updated ON wiki_pages(updated_at DESC);

        -- 3. Labels + the flat page↔label join.
        CREATE TABLE IF NOT EXISTS wiki_labels (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name       TEXT NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS wiki_page_labels (
          page_id  UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
          label_id UUID NOT NULL REFERENCES wiki_labels(id) ON DELETE CASCADE,
          PRIMARY KEY (page_id, label_id)
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_page_labels_label ON wiki_page_labels(label_id);

        -- 4. Comments (author + timestamp; author survives as NULL).
        CREATE TABLE IF NOT EXISTS wiki_comments (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          page_id    UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
          author_id  UUID REFERENCES users(id) ON DELETE SET NULL,
          body       TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_comments_page ON wiki_comments(page_id, created_at DESC);

        -- 5. Attachments: METADATA ONLY — no file bytes ever enter Postgres.
        --    visibility decides how /api/wiki/files/[id] serves the object:
        --    'private' → short-lived presigned URL, 'public' → the public base.
        CREATE TABLE IF NOT EXISTS wiki_attachments (
          id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          page_id     UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
          uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
          file_name   TEXT NOT NULL,
          mime_type   TEXT NOT NULL,
          size_bytes  BIGINT NOT NULL,
          s3_key      TEXT NOT NULL,
          visibility  TEXT NOT NULL DEFAULT 'private'
                      CHECK (visibility IN ('public', 'private')),
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_attachments_page ON wiki_attachments(page_id);

        -- 6. Audit trail for every wiki/storage mutation (mirrors role_audit).
        CREATE TABLE IF NOT EXISTS wiki_audit (
          id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable: audit outlives actors
          action     TEXT NOT NULL,  -- 'page.created' | 'page.updated' | 'page.deleted' | ...
          target     TEXT NOT NULL,  -- raw id string, not an FK: the row must survive its subject
          diff       JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_wiki_audit_target_created ON wiki_audit(target, created_at DESC);

        -- ---- Schema v5: BMad Monitor Integration (Kanban, Worktree, Backlog) -
        -- 1. BMad Projects
        CREATE TABLE IF NOT EXISTS bmad_projects (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL,
          git_remote_url TEXT,
          workspace_path TEXT,
          owner_id       UUID REFERENCES users(id) ON DELETE SET NULL,
          team_id        TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 2. Context reference files reported by BMad skills
        CREATE TABLE IF NOT EXISTS bmad_context_files (
          id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id      TEXT NOT NULL REFERENCES bmad_projects(id) ON DELETE CASCADE,
          path            TEXT NOT NULL,
          description     TEXT NOT NULL DEFAULT '',
          file_size_bytes BIGINT NOT NULL DEFAULT 0,
          last_modified   TIMESTAMPTZ NOT NULL DEFAULT now(),
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bmad_context_files_project ON bmad_context_files(project_id);

        -- 3. Kanban Task Items (AffectUI Agent Inbox compatible)
        CREATE TABLE IF NOT EXISTS bmad_tasks (
          id               TEXT PRIMARY KEY,
          project_id       TEXT NOT NULL REFERENCES bmad_projects(id) ON DELETE CASCADE,
          title            TEXT NOT NULL,
          description      TEXT NOT NULL DEFAULT '',
          stage            TEXT NOT NULL DEFAULT 'ready_for_review',
          priority         TEXT NOT NULL DEFAULT 'medium',
          approval_status  TEXT NOT NULL DEFAULT 'pending',
          rejection_reason TEXT,
          assigned_agent   TEXT NOT NULL DEFAULT 'bmad-agent',
          context_files    JSONB NOT NULL DEFAULT '[]'::jsonb,
          checklists       JSONB NOT NULL DEFAULT '[]'::jsonb,
          steps            JSONB NOT NULL DEFAULT '[]'::jsonb,
          sources          INT NOT NULL DEFAULT 0,
          tool_calls       INT NOT NULL DEFAULT 0,
          duration         TEXT NOT NULL DEFAULT '0s',
          created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bmad_tasks_project_stage ON bmad_tasks(project_id, stage);

        -- 4. Agent Tree Nodes (AffectUI Agent Tree compatible with Token Usage)
        CREATE TABLE IF NOT EXISTS bmad_agent_nodes (
          id           TEXT PRIMARY KEY,
          project_id   TEXT NOT NULL REFERENCES bmad_projects(id) ON DELETE CASCADE,
          task_id      TEXT REFERENCES bmad_tasks(id) ON DELETE SET NULL,
          parent_id    TEXT REFERENCES bmad_agent_nodes(id) ON DELETE CASCADE,
          name         TEXT NOT NULL,
          role         TEXT NOT NULL DEFAULT 'orchestrator',
          status       TEXT NOT NULL DEFAULT 'running',
          action       TEXT NOT NULL DEFAULT '',
          duration_ms  BIGINT NOT NULL DEFAULT 0,
          token_usage  JSONB NOT NULL DEFAULT '{"inputTokens":0,"outputTokens":0,"totalTokens":0}'::jsonb,
          model_used   JSONB NOT NULL DEFAULT '{"provider":"Anthropic","modelId":"claude-sonnet-5-5"}'::jsonb,
          artifacts    JSONB NOT NULL DEFAULT '[]'::jsonb,
          tools        JSONB NOT NULL DEFAULT '[]'::jsonb,
          error_detail TEXT,
          timestamp    TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bmad_agent_nodes_project ON bmad_agent_nodes(project_id);
        CREATE INDEX IF NOT EXISTS idx_bmad_agent_nodes_parent ON bmad_agent_nodes(parent_id);

        -- 5. Backlog & Code Impact Analysis
        CREATE TABLE IF NOT EXISTS bmad_backlogs (
          id              TEXT PRIMARY KEY,
          project_id      TEXT NOT NULL REFERENCES bmad_projects(id) ON DELETE CASCADE,
          title           TEXT NOT NULL,
          raw_description TEXT NOT NULL DEFAULT '',
          source          TEXT NOT NULL DEFAULT 'web',
          created_by      TEXT NOT NULL DEFAULT '',
          status          TEXT NOT NULL DEFAULT 'draft',
          impact_analysis JSONB,
          created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_bmad_backlogs_project ON bmad_backlogs(project_id);

        -- 6. Multi-Provider LLM Vault
        CREATE TABLE IF NOT EXISTS bmad_llm_providers (
          id             TEXT PRIMARY KEY,
          name           TEXT NOT NULL,
          provider_type  TEXT NOT NULL DEFAULT 'anthropic',
          base_url       TEXT NOT NULL,
          api_key        TEXT NOT NULL,
          model_id       TEXT NOT NULL,
          is_team_shared BOOLEAN NOT NULL DEFAULT false,
          registered_by  TEXT NOT NULL DEFAULT '',
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        -- 7. Seed default project if none exists
        INSERT INTO bmad_projects (id, name, git_remote_url, workspace_path) VALUES
          ('prj_default', 'Agentic Engineering Workflow', 'git@github.com:fatmuh/agentic-engineering-workflow.git', '/Volumes/DevWorkspace/Development/Projects/apps/agentic-engineering-workflow')
        ON CONFLICT (id) DO NOTHING;
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

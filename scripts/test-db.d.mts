/**
 * Type declarations for scripts/test-db.mjs — the shared test-database module.
 * TypeScript resolves an `.mjs` import through its `.d.mts` sibling (JS-source
 * inference of the destructured option bags is unreliable); the runtime
 * implementation and its full documentation live in test-db.mjs. Keep the two
 * in sync when changing the module's surface.
 */

/** Make `.env.local` visible to plain node. Idempotent; never overrides. */
export function loadTestEnv(): NodeJS.ProcessEnv;

/** The base (dev) connection string: $DATABASE_URL, loaded from .env.local if unset. */
export function baseConnectionString(): string;

/** Run-unique scratch database name: `rbac_test_<pid>_<epoch-ms>`. */
export function deriveScratchDbName(): string;

/** Rewrite only the database segment of a URL-style connection string. */
export function scratchConnectionString(base: string, name: string): string;

export interface ScratchDbOptions {
  /** Scratch database name; defaults to $E2E_SCRATCH_DB_NAME. */
  name?: string;
  /** Base connection string used as the CREATE/DROP admin target; defaults to
   *  $E2E_BASE_DATABASE_URL, then the base string. */
  base?: string;
}

/** DROP IF EXISTS (WITH FORCE) + CREATE. Returns the scratch name used. */
export function createScratchDb(options?: ScratchDbOptions): Promise<string>;

export interface DropScratchDbOptions extends ScratchDbOptions {
  /** Suppress log lines — used by the boot script's exit-path safety net. */
  quiet?: boolean;
}

/** DROP IF EXISTS (WITH FORCE), tolerant of absence and of failure. */
export function dropScratchDb(options?: DropScratchDbOptions): Promise<void>;

export interface ReapStaleScratchDbsOptions {
  /** Admin connection target; same default as ScratchDbOptions.base. */
  base?: string;
  /** A scratch database younger than this is assumed to belong to a live run. */
  maxAgeMs?: number;
}

/**
 * Drop scratch databases left by runs killed before teardown could run.
 * Only generated-shape names (`rbac_test_<pid>_<epoch-ms>`) older than
 * maxAgeMs (default 15 minutes) are touched. Returns the reaped names.
 */
export function reapStaleScratchDbs(options?: ReapStaleScratchDbsOptions): Promise<string[]>;

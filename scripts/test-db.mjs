/**
 * Shared per-run scratch-database helpers for the test harness.
 *
 * Every suite that needs a database (the playwright e2e suite today, the
 * vitest fixture matrix in the next story) runs against a throwaway database
 * whose name is derived once per run, so the dev database is never a test
 * target:
 *
 *   deriveScratchDbName()      run-unique name (pid + timestamp, valid pg identifier)
 *   scratchConnectionString()  rewrites ONLY the database segment of a base URL
 *   createScratchDb()          DROP IF EXISTS + CREATE (reclaims a dead prior run)
 *   dropScratchDb()            DROP IF EXISTS ... WITH (FORCE), tolerant of absence
 *   reapStaleScratchDbs()      sweeps orphans of hard-killed runs (called on boot)
 *
 * The app itself does all schema/seed work (`src/lib/db.ts` query() →
 * ensureSchema()); this module only creates and drops the database.
 *
 * Plain node ESM with no build step: playwright's webServer command, playwright's
 * globalTeardown and vitest's globalSetup all import this same module. Plain node
 * does not read `.env.local`, so this module loads it itself, with a minimal
 * inline loader (no dotenv dependency — dotenv is not declared in package.json;
 * same convention as scripts/seed-users.mjs) that never overrides variables
 * already present in the environment: an exported DATABASE_URL, or the scratch
 * URL playwright injects into the webServer process, always wins.
 *
 * CJS-transform constraint: playwright loads playwright.config.ts and the
 * teardown by transpiling them (and this module) to CommonJS in memory, where
 * `import.meta` is a syntax error. So this module must stay free of
 * `import.meta` — `.env.local` resolves from process.cwd() instead, which every
 * consumer (playwright runner/webServer, vitest, npm scripts) runs with at the
 * repo root.
 *
 * Context note: in the webServer boot process DATABASE_URL is already the
 * SCRATCH string, so that process passes the base string explicitly via
 * E2E_BASE_DATABASE_URL instead of calling baseConnectionString().
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const ENV_FILE = resolve(process.cwd(), ".env.local");

/** Postgres identifiers are limited to 63 bytes; rbac_test_<pid>_<epoch-ms> is ~31. */
const SCRATCH_PREFIX = "rbac_test_";

/** Only databases whose name carries the exact generated shape are ever
 *  reaped — see reapStaleScratchDbs. */
const SCRATCH_NAME_PATTERN = /^rbac_test_\d+_\d+$/;

let envLoaded = false;

/** Minimal `.env.local` loader — no dotenv dependency (same convention as
 *  scripts/seed-users.mjs; dotenv is not declared in package.json). Reads the
 *  file from disk, strips one pair of surrounding quotes, trims trailing
 *  whitespace from the value (split on "\n" keeps a CRLF file's "\r"), and
 *  never overrides a variable already present in the environment. */
function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "").trimEnd();
      }
    }
  } catch {
    // No .env.local — rely on the real environment.
  }
}

/** Make `.env.local` visible to plain node. Idempotent; never overrides. */
export function loadTestEnv() {
  if (!envLoaded) {
    loadEnvFile(ENV_FILE);
    envLoaded = true;
  }
  return process.env;
}

/**
 * The base connection string (whatever DATABASE_URL points at — normally the
 * dev database from .env.local). Scratch names are derived from it and admin
 * connections (CREATE/DROP DATABASE) connect to it, but no harness write ever
 * lands in its tables.
 */
export function baseConnectionString() {
  loadTestEnv();
  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error("DATABASE_URL is not set. Add it to .env.local");
  }
  return base;
}

/** Run-unique scratch database name: pid + timestamp keeps concurrent and
 *  sequential runs from colliding, including with leftovers of runs whose
 *  teardown never ran. */
export function deriveScratchDbName() {
  return `${SCRATCH_PREFIX}${process.pid}_${Date.now()}`;
}

/** Rewrite only the database segment of a URL-style connection string.
 *  Everything else (credentials, host, port, query params) passes through
 *  untouched, so the scratch db lives on the same server as the base db. */
export function scratchConnectionString(base, name) {
  let url;
  try {
    url = new URL(base);
  } catch {
    throw new Error(`DATABASE_URL is not a URL-style connection string: ${base}`);
  }
  url.pathname = `/${name}`;
  return url.toString();
}

/** Quote an identifier for inline SQL (names are generated, but stay safe). */
function ident(name) {
  return `"${name.replaceAll('"', '""')}"`;
}

/** Resolve the admin target: explicit arg, then E2E_BASE_DATABASE_URL, then the
 *  base string. Never DATABASE_URL-when-it-is-already-the-scratch-url: callers
 *  running inside the webServer process pass the base explicitly. */
function adminConnectionString(base) {
  return base ?? process.env.E2E_BASE_DATABASE_URL ?? baseConnectionString();
}

/**
 * Create this run's scratch database. DROP IF EXISTS first reclaims the name if
 * a prior run died before its teardown. WITH (FORCE) detaches any connection
 * still holding the stale database, so a half-dead prior run cannot wedge boot.
 *
 * The admin connection targets the base string's database (CREATE DATABASE
 * cannot run from inside the database being created) — connecting there writes
 * nothing to it.
 */
export async function createScratchDb({ name, base } = {}) {
  const scratchName = name ?? process.env.E2E_SCRATCH_DB_NAME;
  if (!scratchName) {
    throw new Error("createScratchDb: pass { name } or set E2E_SCRATCH_DB_NAME");
  }
  // Self-heal first: a run interrupted so hard that neither teardown nor the
  // boot script's exit path could drop its database is reclaimed here, by the
  // next run, so orphans cannot accumulate.
  await reapStaleScratchDbs({ base });
  const admin = new pg.Client({ connectionString: adminConnectionString(base) });
  try {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${ident(scratchName)} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${ident(scratchName)}`);
  } finally {
    await admin.end().catch(() => {});
  }
  return scratchName;
}

/**
 * Drop scratch databases left behind by runs that died before any teardown
 * could run (e.g. playwright aborts a not-yet-ready webServer with SIGKILL).
 * Only names carrying the exact generated shape — whose embedded epoch-ms
 * timestamp is older than maxAgeMs — are touched, so a recently started run's
 * database survives. The age threshold is a heuristic, not a lock: the e2e
 * boot pre-checks the harness port before sweeping (a live run holding the
 * port is refused before any DROP), but portless consumers of this module
 * (e.g. a vitest globalSetup) rely on the threshold alone — a run aged past
 * it is assumed dead. Best-effort: failures are logged, never thrown (a
 * failed sweep must not block the run).
 */
export async function reapStaleScratchDbs({ base, maxAgeMs = 15 * 60_000 } = {}) {
  const admin = new pg.Client({ connectionString: adminConnectionString(base) });
  const reaped = [];
  try {
    await admin.connect();
    const result = await admin.query(
      `SELECT datname FROM pg_database WHERE datname LIKE '${SCRATCH_PREFIX}%'`
    );
    const now = Date.now();
    for (const row of result.rows) {
      const name = row.datname;
      if (!SCRATCH_NAME_PATTERN.test(name)) continue;
      const createdAt = Number(name.split("_").pop());
      if (!Number.isFinite(createdAt) || now - createdAt <= maxAgeMs) continue;
      await admin.query(`DROP DATABASE IF EXISTS ${ident(name)} WITH (FORCE)`);
      reaped.push(name);
      console.error(`[test-db] reaped stale scratch database ${name}`);
    }
  } catch (error) {
    console.warn(`[test-db] stale scratch sweep failed: ${error.message}`);
  } finally {
    await admin.end().catch(() => {});
  }
  return reaped;
}

/**
 * Drop this run's scratch database. Tolerant: already-dropped is fine (IF
 * EXISTS), and any other failure is logged, not thrown — teardown must not
 * fail a green run (the next run's DROP IF EXISTS reclaims the name anyway).
 * `quiet` suppresses both messages (used by the boot script's exit path, where
 * the drop is a no-op safety net whenever teardown already ran).
 *
 * WITH (FORCE): the e2e server's pg pool may still hold connections to the
 * scratch database when teardown runs; FORCE detaches them before dropping.
 */
export async function dropScratchDb({ name, base, quiet = false } = {}) {
  const scratchName = name ?? process.env.E2E_SCRATCH_DB_NAME;
  if (!scratchName) {
    return;
  }
  const admin = new pg.Client({ connectionString: adminConnectionString(base) });
  try {
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS ${ident(scratchName)} WITH (FORCE)`);
    if (!quiet) {
      console.error(`[test-db] dropped scratch database ${scratchName}`);
    }
  } catch (error) {
    if (!quiet) {
      console.warn(`[test-db] could not drop scratch database ${scratchName}: ${error.message}`);
    }
  } finally {
    await admin.end().catch(() => {});
  }
}

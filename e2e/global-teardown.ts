import { baseConnectionString, dropScratchDb } from "../scripts/test-db.mjs";

/**
 * Drops this run's scratch database. The name comes from playwright.config.ts's
 * single derivation, carried here via process.env (config and globalTeardown
 * run in the same playwright runner process).
 *
 * Tolerant by design: dropScratchDb treats an already-dropped database (and
 * any other failure) as a warning, never a test failure — a run interrupted so
 * hard that teardown missed is reclaimed by the next run's DROP IF EXISTS.
 * WITH (FORCE) detaches the e2e server's pool connections if it is still up.
 */
export default async function globalTeardown(): Promise<void> {
  const name = process.env.E2E_SCRATCH_DB_NAME;
  if (!name) {
    console.warn("[e2e teardown] E2E_SCRATCH_DB_NAME is not set — nothing to drop");
    return;
  }
  await dropScratchDb({
    name,
    base: process.env.E2E_BASE_DATABASE_URL ?? baseConnectionString(),
  });
}

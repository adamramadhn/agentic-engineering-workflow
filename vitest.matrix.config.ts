import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Per-role API fixture matrix (epic 3 story 2) — a standalone vitest project,
 * invisible to plain `vitest run` (vitest.config.mts includes only the
 * TypeScript test files under src). Run via `npm run test:matrix` or
 * `npm run verify`.
 *
 * The runtime is provisioned by tests/matrix/global-setup.ts: a per-run scratch
 * database (scripts/test-db.mjs) and the production app booted by spawning
 * scripts/e2e-server.mjs on port 4312 (4311 is the e2e harness's port,
 * 3010/3011 are dev servers). Specs drive that app over real HTTP only.
 */
export default defineConfig({
  test: {
    include: ["tests/matrix/**/*.spec.ts"],
    environment: "node",
    globalSetup: ["./tests/matrix/global-setup.ts"],
    // One app + one scratch database: spec files clean up shared fixtures, so
    // they must not race each other — run files sequentially.
    fileParallelism: false,
    // Everything here is real HTTP + bcrypt + pg against a booted server —
    // generous beats flaky. Boot-adjacent waits live in globalSetup, not hooks.
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve("./src"),
    },
  },
});

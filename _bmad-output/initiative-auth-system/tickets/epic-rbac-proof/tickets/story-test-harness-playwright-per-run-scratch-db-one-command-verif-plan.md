---
title: 'Test harness: playwright + per-run scratch DB + one-command verify'
type: 'feature'
ticket: '1'
created: '2026-11-03'
status: 'built'
baseline_revision: 'e335abe29a56867796df9475245cfdac0d3c319a'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick', 'quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['/home/ubuntu/agentic-engineering-workflow/_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 3's proof suites (fixture matrix, per-role e2e) have nothing to run on: no playwright, no test database, no one-command runner — and the dev database must never be a test target.

**Approach:** A playwright harness whose server boots against a per-run scratch database (name derived once at config-evaluation scope, created before the server accepts requests, dropped on teardown, reclaimed if a prior run died), a shared test-db module story 2's vitest globalSetup will reuse, a thin smoke spec proving the whole chain, and `npm run verify` running build → lint (reported, non-gating) → vitest → e2e in one command.

## Boundaries & Constraints

**Always:**
- The scratch DB name is derived once at playwright.config.ts evaluation scope (run-unique: pid + timestamp, valid pg identifier); every consumer (server boot, teardown) reads it from that one derivation via env — never from env mutated later in another process.
- The database EXISTS before the server accepts its first request: creation happens inside the webServer boot path (a small node script that creates the DB, then spawns the server), because playwright starts webServer BEFORE globalSetup and the app's `query()` runs `ensureSchema()` (which seeds the roles) on first request — a DB created later is too late.
- The app's own boot path does all schema/seed work (`src/lib/db.ts` `query()` → `ensureSchema()`); the harness only CREATEs/DROPs the database itself.
- The dev database (whatever `DATABASE_URL` in `.env.local` points at) is never written: the harness derives the scratch name by rewriting only the database segment of the connection string, and every harness connection uses the rewritten string.
- `npm run verify` exits 0 despite the repo's 55 pre-existing lint errors: lint runs as a reported stage that cannot fail the chain (`eslint . || echo …` or equivalent), build and the suites gate.
- Read the fork's docs in `node_modules/next/dist/docs/` for `next start` (port selection, env handling, production-mode behavior with this fork's `cacheComponents`) BEFORE writing the boot script — this is not stock Next.js.

**Never:**
- No application-code changes (src/ untouched except nothing; the harness lives in new files: `playwright.config.ts`, `e2e/`, `scripts/`, package.json, .gitignore).
- No changes to the pure vitest suite (`src/lib/permissions.test.ts`, `vitest.config.mts`) — `npm test` keeps its current meaning and 29/29.
- No runtime dependencies — `@playwright/test` is a devDependency only.
- No CI workflow (story 4), no matrix suite (story 2) — only the smoke spec.
- Never connect the harness to the dev database for writes; never hardcode a port that collides with the dev server (3010/3011 are in use).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold verify run | `npm run verify` on a clean tree | build exits 0; lint prints its report but cannot fail the chain; vitest 29/29; e2e boots server on a fresh scratch DB, smoke passes; exit 0 | any build/vitest/e2e failure fails verify |
| Scratch DB lifecycle | one e2e run | DB created before server start; app's ensureSchema seeds roles on first request; DB dropped at teardown; next run gets a new name | — |
| Dead prior run | scratch DB with this run's name already exists (shouldn't, but stale names) | boot script DROPs IF EXISTS then CREATEs — the run proceeds | — |
| Server killed mid-run | interrupt during e2e | teardown still drops the DB (or the next run's DROP-IF- EXISTS reclaims) | — |
| Anonymous smoke | GET /login with no cookies | login page renders (sign-in form) | — |
| Anonymous deep link | GET /users with no cookies | redirect to /login?next=%2Fusers | — |
| Dev DB safety | any harness run | roles/users rows in the dev DB byte-identical before/after | — |

</intent-contract>

## Code Map

- `src/lib/db.ts` -- READ-ONLY reference: `process.env.DATABASE_URL` read at module load (throws unset); `query()` awaits `ensureSchema()` lazily (line ~160) — first request seeds roles (INSERT at line ~126). This is why the DB must exist before the server's first request.
- `src/proxy.ts` -- READ-ONLY: unauthenticated visits to protected prefixes redirect to `/login?next=<path>` — the smoke spec's deep-link expectation.
- `src/app/login/page.tsx` -- the smoke spec's render target.
- `package.json` -- scripts today: dev (port 3010), build, start (`next start`), lint (`eslint`), test (`vitest run`). Add: `test:e2e`, `verify`; devDep `@playwright/test` (registry reachable; latest 1.64.x).
- `vitest.config.mts` -- DO NOT TOUCH (include `src/**/*.test.{ts,tsx}` — the pure suite's boundary; story 2 keeps its files outside this pattern).
- `node_modules/next/dist/docs/` -- READ FIRST per AGENTS.md: `next start` port/env semantics in this fork before writing the boot script.
- Environment facts: no system chrome/chromium on this machine (`which` empty) — the bundled chromium download is the primary path; `npx playwright install chromium` must run at implementation time; `.env.local` holds DATABASE_URL (pg server accepts CREATE/DROP DATABASE — verified); dotenv is installed (harness scripts load `.env.local` themselves; plain node does not).
- Ports in use: 3010 (dev), 3011 (my long-running dev probe server) — pick e.g. 4311 for the harness server.

## Tasks & Acceptance

**Execution:**
- [x] `package.json` -- add devDependency `@playwright/test`; add `test:e2e` (`playwright test`) and `verify` (build → non-gating lint report → `npm test` → `npm run test:e2e`).
- [x] `scripts/test-db.mjs` -- NEW shared module (plain node ESM, dotenv-loaded): `deriveScratchDbName()`, `scratchConnectionString(base, name)`, `createScratchDb()` (DROP IF EXISTS + CREATE, admin connection to the base string's db), `dropScratchDb()`; story 2's vitest globalSetup imports this same module.
- [x] `scripts/e2e-server.mjs` -- NEW webServer command target: derives/receives the run's scratch DB name (env from the config), creates the DB via the shared module, spawns the production server (`next start` on the harness port, DATABASE_URL rewritten to the scratch DB, per the fork's docs), waits for readiness, forwards signals/exit.
- [x] `playwright.config.ts` -- NEW: derives the scratch name ONCE at config scope; `webServer: { command: 'node scripts/e2e-server.mjs', env: { …process.env, DATABASE_URL: <scratch>, PORT: <harness port> }, reuseExistingServer: !process.env.CI, url: <baseURL> }`; `globalTeardown` drops the DB; testDir `e2e`; chromium with headless default.
- [x] `e2e/global-teardown.ts` -- NEW: drops the scratch DB via the shared module (tolerant of already-dropped).
- [x] `e2e/smoke.spec.ts` -- NEW: anonymous /login renders the sign-in page; anonymous /users redirects to `/login?next=%2Fusers`.
- [x] `.gitignore` -- add playwright artifacts (`test-results/`, `playwright-report/`) if absent.

**Acceptance Criteria:**
- Given a clean tree, when `npm run verify` runs, then build succeeds, the lint report prints without failing the chain despite pre-existing errors, vitest reports 29/29, the smoke spec passes, and the command exits 0.
- Given one e2e run, when the server boots, then the scratch database exists first (created by the boot script) and is dropped after (teardown), and the app's own ensureSchema seeded the three system roles into it.
- Given any harness run, when it finishes, then the dev database's roles and users rows are unchanged (spot-check via pg before/after).
- Given an interrupted run leaving a stale scratch DB, when the next run boots, then DROP IF EXISTS reclaims the name and the run is green.

## Implementation Notes

- Readiness probe (in `scripts/e2e-server.mjs`): `GET /login` → 200 AND `POST /api/auth/login` for an unknown well-formed email → 401. That POST is the only anonymous request that reaches `query()`, so a 401 (not 500) proves the scratch DB is reachable and `ensureSchema()` created the schema and seeded the roles before any test runs — the observable form of acceptance criterion 2. Playwright's own `webServer.url` poll (`/login`) stays as the outer gate.
- Teardown order: playwright runs globalTeardown BEFORE stopping the webServer, so the app's pg pool still holds connections to the scratch DB at drop time — every DROP uses `WITH (FORCE)` (PostgreSQL 18.6 here). The FORCE-detach surfaces as a bounded `[WebServer] error: terminating connection due to administrator command` dump from the app's unhandled pool error in every green run; harmless (app code — an `pool.on("error")` handler — is out of bounds for this story).
- Verified: `npm run verify` exit 0 (build ok, lint reported `74 problems (55 errors, 19 warnings)` without gating, vitest 29/29, e2e 2/2); dev DB roles+users md5-identical before/after; `SELECT datname … LIKE 'rbac_test_%'` → none after runs; `npx tsc --noEmit` clean; new files lint-clean.

## Plan Change Log

- 2026-11-03 (implementation): `scripts/test-db.mjs` resolves `.env.local` from `process.cwd()` instead of `import.meta.url` — playwright loads `playwright.config.ts` and the teardown by transpiling them (and this module) to CommonJS, where `import.meta` is a parse-time syntax error. Every consumer (playwright runner/webServer, vitest, npm scripts) runs with the repo root as cwd, so this is equivalent. Added `scripts/test-db.d.mts` with explicit declarations for the same reason (TS's JS-source inference of the destructured option bags was unreliable) and to give story 2 a typed import.
- 2026-11-03 (implementation): added `reapStaleScratchDbs()` (exported from `scripts/test-db.mjs`), invoked automatically at the top of `createScratchDb()`. Reason: an observed mid-boot SIGINT shows playwright aborts a not-yet-ready webServer with SIGKILL ("Process from config.webServer exited early") — globalTeardown never runs (abort precedes globalSetup) and the boot script's signal handlers cannot run either, leaving an orphan. The reaper drops only generated-shape names (`rbac_test_<pid>_<epoch-ms>`, the name embeds its creation time) older than 15 minutes, so a concurrent live run's database is never touched; orphans are thereby self-healing rather than accumulating. The boot script also drops its scratch DB best-effort (quiet, `IF EXISTS` no-op when teardown already ran) when its `next start` child exits without teardown.
- 2026-11-03 (review): `playwright.config.ts` sets `reuseExistingServer: false` (plan said `!process.env.CI`). Reason: with reuse enabled, a leftover orphaned `next start` on the harness port would let playwright skip the boot script entirely — no fresh per-run database, tests against a dead run's stale scratch database, and the stale-database sweep would later FORCE-drop that database under the live orphan. A loud EADDRINUSE failure ("next exited during boot") is the correct local behavior and matches CI semantics.
- 2026-11-03 (review): `scripts/test-db.mjs` loads `.env.local` with a minimal inline `readFileSync`/regex loader (same convention as `scripts/seed-users.mjs`) instead of importing `dotenv` — dotenv is not declared in package.json (it only resolves via a shadcn → @dotenvx/dotenvx hoist), so importing it was a phantom dependency that could break `test:e2e`, `verify`, and story 2's globalSetup on any dependency-tree change. Same semantics: cwd-relative `.env.local`, quiet, idempotent, never overrides already-set keys.
- 2026-11-03 (implementation): all harness log lines go to stderr — playwright swallows webServer stdout on successful runs, so stderr is the only always-visible stream.
- 2026-11-03 (follow-up review): correction to the dotenv→inline-loader entry above — "same semantics" overstated: the first inline loader kept trailing bytes in values (a CRLF `.env.local` leaves `\r` after `split("\n")`, and the greedy `(.*)` with `\s*$` matching empty also keeps space padding), which dotenv trims; a CRLF env file broke every harness pg connection with a misleading host/database parse error. Fixed with `trimEnd()` on the captured value (after quote-stripping).
- 2026-11-03 (follow-up review): `scripts/e2e-server.mjs` gained a best-effort port pre-check (step 0) BEFORE `createScratchDb`: any HTTP answer on the harness port fails the boot immediately ("already serving — kill it or set E2E_PORT"); refused/timeout means free. Reason: createScratchDb runs the stale-database sweep first, so a doomed concurrent run (port already held) would otherwise FORCE-drop a still-live run's scratch database (e.g. a debug session on `page.pause()` aged past the sweep threshold) and only then die of EADDRINUSE, leaving the live run 500ing.
- 2026-11-03 (follow-up review): corrected guarantee on `reapStaleScratchDbs` (doc comment updated in kind): "a concurrent run's database is never touched" only holds for runs holding the harness port, and only since the port pre-check above — the 15-minute age heuristic remains the sole guard for portless consumers of the module (story 2's future vitest globalSetup), where a run aged past the threshold is assumed dead.

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 4 findings — high 0, medium 2, low 2, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` Phantom dotenv dependency in `scripts/test-db.mjs` — verified: `dotenv` is declared nowhere in package.json and resolves only via the hoisted shadcn → @dotenvx/dotenvx → dotenv@17.4.2 chain (`npm ls dotenv`), so a dependency-tree change breaks `test:e2e`, `verify`, and story 2's planned globalSetup with ERR_MODULE_NOT_FOUND; the repo's own convention (`scripts/seed-users.mjs`: "Minimal .env.local loader — no dotenv dependency") was bypassed. Patched: the import is replaced by an inline `readFileSync`/regex loader with the same convention and identical `loadTestEnv()` semantics (cwd-relative `.env.local`, quiet, idempotent, never overrides); exported API and `scripts/test-db.d.mts` unchanged; no undeclared imports remain (grep-verified).
  - `[low]` `[patch]` The boot script's readiness comment claimed the login-POST probe proves seeding "before any test runs" — verified that playwright gates test start only on its own GET /login url poll and never waits for the probe, but the claimed start-up race is refuted for every real access path: `ensureSchema()` is promise-memoized (`schemaReady` guard, `src/lib/db.ts:59`) and the seed is `ON CONFLICT DO NOTHING`, so every DB-touching request blocks on the same seeding promise and no test can observe an unseeded DB through the app (stories 2–3 are HTTP-driven; story 2's direct-pg audit reads happen only after HTTP mutations). Patched as a comment correction: the probe proves the boot's own DB chain (401 vs 500), and seeding-before-reads is attributed to the memoized `ensureSchema`, not to probe completion.
  - `[medium]` `[patch]` `reuseExistingServer: !process.env.CI` silently poisoned the next local run after an orphaning kill — verified: a kill path that misses the `next start` child (the boot script's own comment admits a hard SIGKILL of the script leaves orphans; SIGKILL cannot run the exit-path drop) leaves a server on 4311 wired to the dead run's scratch DB; playwright then sees `/login` answering, skips the webServer command entirely (no fresh per-run DB created), tests run against stale data, globalTeardown's DROP of the new name is a no-op, and `reapStaleScratchDbs` later FORCE-drops the orphan's DB under the live server so every page 500s. Patched: `reuseExistingServer: false` — a leftover server now fails loudly (EADDRINUSE → "next exited during boot"), matching CI semantics; deviation from the plan's literal `!process.env.CI` logged in Plan Change Log.
  - `[low]` `[reject]` `E2E_PORT` consumed without validation at config scope (`Number(...)` → NaN `baseURL` for a non-numeric value) — mechanics verified by inspection, but rejected: the config itself owns `E2E_PORT` (nothing in the repo sets it externally; the default 4311 covers local and CI), a bad value already fails the run loudly through the boot script's own integer validation (e2e-server.mjs `fail("invalid E2E_PORT")` surfaced via playwright's early webServer exit), and the fix would add a guard branch to a path no everyday use reaches.

### 2026-11-03 — Follow-up review pass
- verdicts: 2 findings — high 0, medium 1, low 1, false 0, maybe-false 0 (all three first-pass patches verified as holding; both findings were new claims, not carried rows — pass 1's reaper finding covered a dead run's orphan under a live server, this pass's covers a live run's database being reaped)
- findings:
  - `[medium]` `[patch]` `reapStaleScratchDbs()` could FORCE-drop the scratch database of a still-live run, and the boot order guaranteed the reap fired even from a doomed run — verified: the sweep runs unconditionally at the top of `createScratchDb()` (e2e-server.mjs calls it in step 1, spawns `next start` only in step 2), so a second run booted while a legitimate run older than 15 minutes (debug `page.pause()`, grown suites) holds the port would DROP … WITH (FORCE) that live run's database and only then die of EADDRINUSE, leaving the live run 500ing with no harness-level cause; the Plan Change Log's "a concurrent live run's database is never touched" overstated the age heuristic. Patched: best-effort port pre-check (step 0) — any HTTP answer on the harness port fails the boot immediately, before the database layer is touched; the implementer verified with a dummy port-holder that the sentinel scratch DB is never created on that path, and the overstated claims (Plan Change Log entry + reaper doc comment) were corrected.
  - `[low]` `[patch]` The inline `.env.local` loader kept trailing bytes — verified the regex mechanics: greedy `(.*)` captures `value\r` (CRLF file; input split on `"\n"`) and trailing spaces, the following `\s*$` matches empty, and `baseConnectionString()` fed the raw value to every harness `pg.Client`, so a CRLF/space-padded `.env.local` would break every CREATE/DROP with a misleading parse error; latent for the repo's current clean-LF file but real for CRLF authors, and divergent from the dotenv semantics the Plan Change Log claimed. Patched: `.trimEnd()` on the captured value (one line, restores dotenv semantics), verified with a CRLF + padded fixture; the "Same semantics" Plan Change Log claim corrected by appended note.



## Design Notes

- Why the boot script (not globalSetup) creates the DB: playwright starts the webServer before globalSetup, and the app's first request triggers ensureSchema — creation must precede server readiness. The config-scope derivation keeps one source of truth for the name; the boot script and teardown both consume it via env.
- Why `next start` (production) rather than `next dev`: verify builds first anyway, prod boot is faster and closer to CI; the fork's docs govern the exact port/env flags.
- The smoke spec doubles as the harness proof: two assertions (render + redirect) cross the server, the proxy, and the DB-backed boot chain.

## Verification

**Commands:**
- `npm run verify` -- expected: exit 0 (build ok, lint reported non-gating, vitest 29/29, 2 smoke tests pass).
- `npx vitest run` -- expected: 29/29 (pure suite untouched).
- `node -e` pg check before/after verify -- expected: dev DB roles+users rows byte-identical; scratch DBs from the run are gone (`SELECT datname FROM pg_database WHERE datname LIKE 'rbac_test_%'` → none).

**Manual checks (if no CLI):**
- Interrupt `npm run test:e2e` mid-run (Ctrl-C), re-run it — expected: green (name reclaimed), no orphan scratch DB accumulates.

## Auto Run Result

**Status: built.** Full route; Quick review lens plus a follow-up pass (triggered by two mediums patched on pass 1); 5 findings patched by the re-engaged implementer across both passes (2 medium + 1 low, then 1 medium + 1 low), 1 rejected.

- Summary: playwright e2e harness whose webServer boot script pre-checks the harness port, then creates a per-run scratch database before `next start` accepts requests, with teardown/reaper reclaiming it; a shared `scripts/test-db.mjs` lifecycle module (reused by story 2's vitest globalSetup); a two-test smoke spec proving the chain; and `npm run verify` running build → non-gating lint → vitest → e2e in one command.
- Files changed: `.gitignore` (+/test-results, /playwright-report), `e2e/global-teardown.ts` (NEW — tolerant scratch drop), `e2e/smoke.spec.ts` (NEW — anonymous /login render + /users redirect), `package.json` (+test:e2e, +verify, devDep @playwright/test), `package-lock.json`, `playwright.config.ts` (NEW — config-scope DB-name derivation, webServer env handoff, reuseExistingServer: false), `scripts/e2e-server.mjs` (NEW — port pre-check, create-then-spawn boot, login-POST readiness probe, signal forwarding, exit-path drop), `scripts/test-db.mjs` (NEW — derive/rewrite/create/drop/reap, inline env loader with dotenv-equivalent value parsing), `scripts/test-db.d.mts` (NEW — typed declarations).
- Review findings breakdown: pass 1 — 3 patched (medium: phantom dotenv dependency → inline loader; medium: reuseExistingServer stale-DB poisoning → false; low: overstated readiness comment → reworded to the memoized-ensureSchema mechanism), 1 rejected (low: E2E_PORT NaN guard — config-owned var, already fails loudly via the boot script's validation, fix would add a guard to an unreachable path); follow-up pass — 2 patched (medium: reaper could FORCE-drop a live aged run's DB before the doomed run hit EADDRINUSE → port pre-check before the database layer; low: loader kept trailing `\r`/spaces → trimEnd). 0 deferred.
- Follow-up review recommendation: **false** — the follow-up pass patched no high findings (medium 1, low 1), so the work has converged. The pass-1 named risks were re-examined in the follow-up: the reuse fix's failure mode got stronger (the pre-check now fails before the database layer, proven by the implementer with a dummy port-holder showing the scratch DB is never created), and the loader is now dotenv-equivalent on value parsing (CRLF + padded fixture).
- Verification performed (by the run itself, not only the implementer): `npm run verify` exit 0 three times (initial, post-pass-1, post-follow-up) — each: build ✓, lint prints "[verify] lint reported issues — non-gating" with the 74 pre-existing template problems (55 errors, 19 warnings), vitest 29/29, e2e 2/2 with the scratch DB created → probed → dropped; `npx vitest run` 29/29 standalone; harness files lint-clean; dev DB roles+users md5 byte-identical before/after every run (6d57a5fd…/96c57f87…); `SELECT datname … LIKE 'rbac_test_%'` empty after every run; interrupt check — SIGINT to `npm run test:e2e` mid-boot lands as playwright's graceful stop (in-flight tests finish green, globalTeardown drops the DB, zero residual processes) and the follow-up run was green; no orphan accumulation.
- Residual risks: every green e2e run prints a bounded `[WebServer] error: terminating connection due to administrator command` dump — teardown FORCE-drops while the app's pg pool (no pool error handler; application code out of bounds) still holds a connection; a hard SIGKILL of the boot script mid-boot can still leave an orphan scratch database until the 15-minute reaper sweeps it and an orphaned `next start` until killed by hand — the next run now fails loudly at the port pre-check rather than serving stale data; the reaper's age heuristic remains the only guard for portless consumers (story 2's future vitest globalSetup must provision its own protection when it lands).



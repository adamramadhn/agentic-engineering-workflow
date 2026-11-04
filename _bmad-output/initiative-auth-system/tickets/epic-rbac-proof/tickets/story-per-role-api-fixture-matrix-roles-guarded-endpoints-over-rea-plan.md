---
title: 'Per-role API fixture matrix: roles × guarded endpoints over real HTTP'
type: 'feature'
ticket: '2'
created: '2026-11-03'
status: 'built'
baseline_revision: 'cab3eca42644f9aa368910fb29fd24e2d0b6867f'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['/home/ubuntu/agentic-engineering-workflow/_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md']
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** The RBAC API surface (epics 1–2) has no per-role proof: nothing pins, per role, which guarded endpoints answer 200/201 and which answer 403/401, that the design §9 guard cases actually fire with their pinned statuses, and that every successful roles mutation writes exactly one audit row.

**Approach:** A standalone vitest project (`vitest.matrix.config.ts` + `tests/matrix/`, invisible to plain `vitest run`) whose globalSetup provisions its own runtime — per-run scratch DB via story 1's `scripts/test-db.mjs`, app booted by spawning story 1's `scripts/e2e-server.mjs` on its own port (4312) — and whose specs drive the running app over HTTP with per-role login cookies, asserting the full roles × endpoints matrix, the 401 row set, the design §9 guard cases, per-mutation audit rows read over pg, and the users.role FK — with `test:matrix` wired into `npm run verify`.

## Boundaries & Constraints

**Always:**
- HTTP-level only: every API assertion drives the booted app with real fetches and replayed login cookies (`ACCESS_COOKIE` from the login response's `set-cookie`, replayed as a `Cookie` header) — never unit-invoked route handlers.
- The endpoint inventory below is the contract: every route in it appears in the 401 row set and in the per-role matrix.
- The suite provisions its own runtime and tears it down: scratch DB created before the server spawns, server spawned from `scripts/e2e-server.mjs` (env contract: `E2E_SCRATCH_DB_NAME`, `DATABASE_URL` rewritten to the scratch string, `E2E_BASE_DATABASE_URL`, `E2E_PORT=4312`), readiness awaited (same probe the script uses: `GET /login` 200 AND login POST → 401), server killed + DB dropped in teardown — zero reliance on playwright.
- Fixtures create and clean their own roles/users: everything the suite creates carries the `matrix-` key prefix / `@matrix.test` email domain; per-test artifacts are deleted in `afterEach`, and per-run state dies with the scratch DB.
- `npm test` keeps its current meaning: the matrix files live under `tests/matrix/` with their own config; plain `vitest run` (vitest.config.mts includes `src/**/*.test.{ts,tsx}`) never discovers them, and the pure suite stays 29/29 untouched.
- `npm run verify` runs the matrix: `test:matrix` joins the chain after `npm test` and before `npm run test:e2e` (build precedes both, satisfying the boot script's `.next/BUILD_ID` check).
- Audit assertions read the scratch DB over pg (`role_audit` rows keyed by `role_key` + `action`, asserting count, `actor_id`, and `diff` shape per successful ROLES mutation; a users-create asserts zero new rows).

**Never:**
- No application-code changes (`src/` untouched — the matrix is proof, not repair; defects it exposes go back through the owning epic's tickets).
- No changes to `vitest.config.mts` or `src/lib/permissions.test.ts`.
- No playwright involvement, no CI workflow (story 3 owns e2e specs, story 4 owns CI).
- Never connect to the dev database; never reimplement the DB lifecycle (reuse `scripts/test-db.mjs` exports) or the boot logic (spawn `scripts/e2e-server.mjs`).
- Ports 3010/3011 (dev) and 4311 (e2e harness) are off-limits; the matrix owns 4312.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Cold verify | `npm run verify` | build → non-gating lint → vitest 29/29 → matrix green on self-provisioned scratch DB + port 4312 → e2e 2/2; exit 0 | any matrix failure fails verify |
| Standalone matrix | `npm run test:matrix` after a build | green from cold: scratch DB created, server booted, all specs pass, teardown drops DB + kills server | missing `.next/BUILD_ID` → boot script's clear failure |
| Concurrent e2e + matrix | both suites in one verify | disjoint ports (4311/4312) and disjoint scratch DBs; sequential in verify anyway | each boot's port pre-check fails loudly on a taken port |
| Per-role matrix | Admin/Editor/Member/matrix-custom × 7 guarded ops | the status table in the inventory below | — |
| Unauthenticated | every guarded op, no cookie | 401 `{"error":"Not authenticated"}` — all 7 routes | — |
| Guard cases | own-role edit / system delete / in-use delete / unknown permission / unknown role | 403 / 409 / 409+userCount / 400 / 400 per inventory | — |
| Fresh grant resolution | deputy role's grants replaced after deputy logged in | deputy's next request resolves CURRENT grants (403 on roles routes) — the reachable face of the lockout guard | — |
| Audit | each successful roles mutation | exactly one `role_audit` row with action + actor_id + diff | users-create: zero rows |
| FK | pg INSERT user with non-existent role | rejected, SQLSTATE 23503 | — |
| Dev DB safety | any run | dev DB roles/users byte-identical before/after | — |

</intent-contract>

## Endpoint Inventory (recorded before implementation — the suite's contract)

Guard = `requirePermission` (src/lib/permission-guard.ts:19-34): no session → 401 `{"error":"Not authenticated"}`; lacking → 403 `{"error":"Forbidden","requiredPermission":…}`. Success = 200 except the two POSTs (201).

| # | Route | Guard | Success | Verified failure modes (file:line) |
|---|-------|-------|---------|-----------------------------------|
| 1 | `GET /api/users` | `users.view` | 200 `{users}` | users/route.ts:41-51 |
| 2 | `POST /api/users` | `users.create` | 201 `{user,users}` (route.ts:110) | 400 unknown role (:85, role check precedes dup-email), 400 missing/invalid fields (:65-79), 409 duplicate email (:88-94) |
| 3 | `GET /api/roles` | `roles.view` | 200 `{roles}` with `userCount` (route.ts:45-55) | — |
| 4 | `POST /api/roles` | `roles.manage` | 201 `{role}` (route.ts:146); key server-derived (slugify :27-32) | 400 unknown permission `invalidPermissions` (:90-96), 400 non-array (:78-88), 400 name (:70-72, :98-104), 409 key exhaustion (:130-135) |
| 5 | `PATCH /api/roles/[key]` | `roles.manage` | 200 `{role}` (route.ts:79; name/description only, key immutable) | 404 (:23-25, :62-64), 400 nothing-to-update/type/empty (:32-47) |
| 6 | `DELETE /api/roles/[key]` | `roles.manage` | 200 `{deleted:true}` (route.ts:146) | **409 system role** (:104-106), **409 in-use + `userCount`** (:118-134), 404 |
| 7 | `PATCH /api/roles/[key]/permissions` | `roles.manage` | 200 `{role}` (route.ts:99; full-set replace) | 404 (:27-29), **403 own-role edit** (:35-40, `key === guard.user.role`), 400 body/unknown permission (:44-54), 409 last-holder (:71-76 — see unreachability note) |

**Per-role success matrix** (seed grants: Admin `["*"]`; Editor `home.view, ask-ai.view, ask-ai.use, agent-board.view, watching.view, users.view, users.create, users.update`; Member `home.view, ask-ai.view, ask-ai.use, agent-board.view, watching.view`; `matrix-custom` = suite-created `["roles.view"]`):

| Fixture | 1 GET users | 2 POST users | 3 GET roles | 4 POST roles | 5 PATCH role | 6 DELETE role | 7 PATCH perms |
|---------|------------|-------------|------------|-------------|-------------|--------------|---------------|
| Admin | 200 | 201 | 200 | 201 | 200 | 200 | 200 |
| Editor | 200 | 201 | 403 | 403 | 403 | 403 | 403 |
| Member | 403 | 403 | 403 | 403 | 403 | 403 | 403 |
| matrix-custom | 403 | 403 | 200 | 403 | 403 | 403 | 403 |
| unauthenticated | 401 | 401 | 401 | 401 | 401 | 401 | 401 |

**Design §9 guard cases and their constructions:**
- Own-role permissions edit → 403: Admin `PATCH /api/roles/Admin/permissions` (key === own role).
- Delete system role → 409: Admin `DELETE /api/roles/Editor` (is_system check precedes the in-use check, route :104 before :113).
- Delete role with attached users → 409 + `userCount`: `DELETE /api/roles/matrix-custom` while its fixture user holds it → `userCount: 1`.
- POST /api/roles unknown permission → 400: permissions `["nonsense.view"]` → `invalidPermissions: ["nonsense.view"]`, asserted BEFORE any INSERT (a 400 never mutates — no role row appears).
- POST /api/users unknown role → 400: role `"Nope"` → `{"error":"Unknown role"}`.
- Stripping `roles.manage` from its last holder → 409: **unreachable over HTTP by construction, recorded here as such.** Proof: any request reaching guard 3 passed guards 1–2 — a session whose CURRENT grants (fresh roles JOIN per request, auth.ts:93-104 `loadUserByIdRow`) include `roles.manage`, on a role that is not the edited key (own-role guard). In `wouldLeaveNoManageHolder` (permissions.ts:209-222) that actor's role holds manage with `userCount ≥ 1` (the actor), so `holders ≥ 1` always. The route's own comment says guard 3 is defense-in-depth, "near-unreachable" behind guards 1+2. The computation itself is pinned by the pure suite (src/lib/permissions.test.ts:228-259, part of the 29). The matrix instead proves the guard's reachable face: a `matrix-deputy` role (`["roles.manage","roles.view"]`) with an attached user is stripped to `["roles.view"]` by Admin (200 + audit), and the deputy's NEXT request — same login, no re-login — resolves the fresh grants and gets 403 on `GET /api/roles`.

## Code Map

- `scripts/test-db.mjs` (+ `scripts/test-db.d.mts`) — REUSE, never reimplement: `loadTestEnv()`, `baseConnectionString()`, `deriveScratchDbName()` (same `rbac_test_` prefix → reaper-compatible), `scratchConnectionString(base, name)`, `createScratchDb({name, base})` (reaps stale orphans first), `dropScratchDb({name, base, quiet})`.
- `scripts/e2e-server.mjs` — REUSE as the boot target: spawn `node scripts/e2e-server.mjs` with env `{...process.env, E2E_SCRATCH_DB_NAME, DATABASE_URL: <scratch>, E2E_BASE_DATABASE_URL: <base>, E2E_PORT: "4312"}`; it pre-checks the port, creates the DB BEFORE spawning `next start`, probes readiness (`GET /login` + login POST → 401), forwards signals, and drops the DB when its child exits. Teardown = SIGTERM the child, then `dropScratchDb` as safety net (its exit-path drop makes that a quiet no-op).
- `src/lib/auth-constants.ts` — `ACCESS_COOKIE` name (import-free alternative: parse the login response's `set-cookie` — take the access cookie's value; the specs replay `Cookie: <ACCESS_COOKIE>=<jwt>`).
- `src/lib/auth.ts` — `hashPassword` = bcrypt cost 10 (:35-37, `BCRYPT_COST = 10` :18) for pg-seeded fixture users; `issueTokenPair` sets both cookies httpOnly (:131-160); `getSessionUser` verifies the JWT then re-loads the user row with a live roles JOIN (:350-360) — grants are fresh per request (the deputy case depends on this).
- `src/app/api/auth/login/route.ts` — login by `{email, password}` → 200 + `set-cookie` pair; unknown email still runs a dummy bcrypt compare then 401 (:23-36) — timing-safe.
- Route files + line cites — the inventory table above is the authority; `src/lib/roles.ts:91` is the sole `role_audit` writer (actions `role.created` / `role.updated` / `role.deleted` / `role.permissions.replaced`; diff shapes in the four route files' `writeRoleAudit` calls).
- `vitest.config.mts` — DO NOT TOUCH; its include `src/**/*.test.{ts,tsx}` is what keeps `tests/matrix/**` invisible to plain `vitest run`.
- `package.json` — add `"test:matrix": "vitest run --config vitest.matrix.config.ts"`; `verify` becomes `next build && (npm run lint || echo "[verify] lint reported issues — non-gating") && npm test && npm run test:matrix && npm run test:e2e`.
- Environment facts: Node ≥ 20 fetch with `response.headers.getSetCookie()`; vitest globalSetup runs before workers fork, so `process.env.MATRIX_*` set there reach the specs; `pg` is a runtime dep (import directly in the helper); `.next/BUILD_ID` must exist (verify builds first — standalone `test:matrix` without a build fails with the boot script's clear message); audit reads connect to the scratch string, never the dev DB.

## Tasks & Acceptance

**Execution:**
- [ ] `vitest.matrix.config.ts` -- NEW: include `["tests/matrix/**/*.spec.ts"]`, node environment, `globalSetup: ["./tests/matrix/global-setup.ts"]`, `@` alias, generous `testTimeout`/`hookTimeout` (boot-adjacent waits live in globalSetup, not hooks).
- [ ] `tests/matrix/global-setup.ts` -- NEW: load env, derive scratch name + strings, spawn `scripts/e2e-server.mjs` on 4312 with the env contract, await readiness (poll `GET /login` 200 then login POST → 401), publish `MATRIX_BASE_URL` / `MATRIX_DB_URL` via `process.env`; teardown (returned function or `globalTeardown`): SIGTERM the boot child, wait exit, `dropScratchDb` safety net.
- [ ] `tests/matrix/helpers.ts` -- NEW: pg pool bound to `MATRIX_DB_URL`; `login(email, password)` → captured access-cookie string; `api(path, {method, body, cookie})` → fetch wrapper returning `{status, body}`; `seedFixtureUsers()` (bcrypt cost 10: `admin@matrix.test`/Admin, `editor@matrix.test`/Editor, `member@matrix.test`/Member); audit query helper (count + rows by role_key/action); fixture cleanup helpers (`matrix-` prefix / `@matrix.test` domain).
- [ ] `tests/matrix/matrix.spec.ts` -- NEW: the per-role status table (Admin/Editor/Member/matrix-custom × 7 ops; matrix-custom created via HTTP as Admin — asserting 201 + audit — with its fixture user via `POST /api/users`, doubling as the users-create-no-audit assertion) + the 401 row set (all 7 ops, no cookie).
- [ ] `tests/matrix/guard-cases.spec.ts` -- NEW: own-role 403; system-role delete 409; in-use delete 409 + `userCount: 1`; POST roles unknown permission 400 (+ no role row created); POST users unknown role 400; deputy strip → 200 + audit, then deputy's next `GET /api/roles` → 403 (fresh resolution); FK: pg INSERT with role `"NoSuchRole"` rejected SQLSTATE 23503.
- [ ] `tests/matrix/audit.spec.ts` -- NEW: one row per successful roles mutation — created (diff `{name, permissions}`), updated (before/after name+description), deleted (diff `{name}`), permissions.replaced (diff `{before, after}`) — each with `actor_id` = the calling fixture user's id; users-create adds zero rows.
- [ ] `package.json` -- `test:matrix` script; wire into `verify` between `npm test` and `npm run test:e2e`.

**Acceptance Criteria:**
- Given a built tree, when `npm run test:matrix` runs, then it provisions its own scratch DB + server (no playwright), runs every inventory row green, and tears both down (`rbac_test_%` empty after; port 4312 free).
- Given `npm run verify`, then build → non-gating lint → vitest 29/29 → matrix → e2e 2/2, exit 0.
- Given any single flipped expectation (one status temporarily edited), the matrix fails.
- Given any run, the dev DB's roles/users rows are byte-identical before/after.

## Implementation Notes

- Reuse over rebuild: the only new runtime code is config + globalSetup + helpers + specs; DB lifecycle and boot logic are story 1's, exercised through their exported surface.
- The 409-last-holder unreachability proof lives in the inventory section — the implementer must NOT try to force it over HTTP (any such attempt unit-invokes or mocks); the deputy-fresh-resolution case is its reachable stand-in.
- Boot child stderr: the boot script logs to stderr by design; globalSetup may pipe it through prefixed (`[matrix-boot]`) for diagnosability.
- The e2e and matrix boots each derive their own scratch names — no shared state; verify runs them sequentially (matrix before e2e; both after build).

## Plan Change Log

- 2026-11-03 (implementation, teardown hardening): `tests/matrix/global-setup.ts` spawns the boot supervisor `detached: true` (own process group), and `stopChild`'s 30s kill-timer fallback now SIGKILLs the whole group (`process.kill(-child.pid, "SIGKILL")`, guarded for the ESRCH race where it already exited) instead of the supervisor alone. Rationale: `scripts/e2e-server.mjs` spawns `next start` as its own process — on the hung-graceful-path branch (e.g. `next start` not exiting on SIGTERM), SIGKILLing only the supervisor orphaned that grandchild on port 4312 while the safety-net `dropScratchDb` FORCE-dropped the database it was still serving, breaching the "port 4312 free after the run" acceptance criterion on that path. The graceful SIGTERM-first path is unchanged.
- 2026-11-03 (implementation, deputy-case deviation): the task text says the stripped deputy "gets 403 on `GET /api/roles`", which contradicts the plan's own per-role matrix — `GET /api/roles` guards `roles.view`, a grant the deputy KEEPS after the strip to `["roles.view"]` (the matrix shows a `roles.view`-only holder, matrix-custom, answered 200 there). The suite instead asserts the plan's I/O-matrix wording "deputy's next request resolves CURRENT grants (403 on roles routes)": kept grant `GET /api/roles` → 200 AND lost grant `POST /api/roles` → 403 (`requiredPermission: "roles.manage"`), on the SAME cookie, no re-login (tests/matrix/guard-cases.spec.ts). The strip target `["roles.view"]`, the 200 + audit assertions, and the fresh-resolution proof are exactly as specified.

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` The deputy fresh-resolution test asserts the opposite status from the plan's task text ("deputy's next `GET /api/roles` → 403") — verified that the plan's wording contradicts the plan's own per-role matrix: `GET /api/roles` guards `roles.view`, a grant the stripped-to-`["roles.view"]` deputy keeps, so the literal task text is unachievable as written; the implementation asserts the correct, stronger reading (kept grant 200 + lost grant 403 on POST, same cookie, no re-login). Rejected because the fix is editing this build's plan; the deviation is instead recorded in the Plan Change Log (the sanctioned mechanism), and the code needs no change.
  - `[low]` `[patch]` Teardown's 30s SIGKILL fallback killed only the boot supervisor — verified: `scripts/e2e-server.mjs` spawns `next start` as its own process, so a hung graceful path (e.g. `next start` not exiting on SIGTERM) would orphan the grandchild on port 4312 while the safety-net `dropScratchDb` FORCE-dropped the database it still served, breaching the "port 4312 free" acceptance criterion on that path. Patched: supervisor spawned `detached: true` (own process group) and the kill-timer now SIGKILLs the whole group (`process.kill(-child.pid, …)`, ESRCH-guarded); graceful SIGTERM-first path unchanged.


## Design Notes

- Why vitest (not playwright) for the API matrix: per-role × per-endpoint assertions are data-shape checks (status + body + audit rows) with no DOM — vitest keeps them fast, debuggable, and CI-cheap; playwright stays for browser journeys (story 3).
- Why spawn `e2e-server.mjs` rather than a bespoke boot: one boot path means one set of failure modes; the port pre-check, create-before-spawn ordering, readiness probe, and exit-path drop all come along for free, and the matrix's globalSetup gets the same loud failures story 1 built.
- Why fixture users are pg-seeded but the custom role is HTTP-created: the seeded roles' guard behavior is what the matrix proves — creating the custom role THROUGH the API exercises POST /api/roles + its audit row as a side effect, while pg-seeding users avoids a chicken-and-egg admin.

## Verification

**Commands:**
- `npm run verify` -- expected: exit 0 (build, non-gating lint, vitest 29/29, matrix green on its own scratch DB + port 4312, e2e 2/2).
- `npm run test:matrix` -- expected: green standalone after a build; teardown leaves `SELECT datname FROM pg_database WHERE datname LIKE 'rbac_test_%'` empty and port 4312 free.
- `npx vitest run` -- expected: still 29/29, matrix files not discovered.
- `node -e` pg check before/after -- expected: dev DB roles+users rows byte-identical.

**Manual checks (if no CLI):**
- Flip one expected status in the matrix (e.g. Editor `GET /api/users` 200 → 403), re-run `npm run test:matrix` -- expected: fails; revert. Confirm no `matrix-` roles / `@matrix.test` users survive a run in the scratch DB (within-suite cleanup works).

## Auto Run Result

**Status: built.** Full route; Quick review lens, 1 finding patched by the re-engaged implementer (low), 1 rejected (low); no follow-up pass required (no high patched, fewer than two mediums).

- Summary: a standalone vitest matrix project (`vitest.matrix.config.ts` + `tests/matrix/`, invisible to plain `vitest run`) whose globalSetup provisions its own runtime — per-run scratch DB via `scripts/test-db.mjs`, app booted by spawning `scripts/e2e-server.mjs` on port 4312 — driving the running app over HTTP with per-role login cookies: 28 per-role matrix cells + 7 unauthenticated 401 rows + 7 guard cases + deputy fresh-grant resolution + FK rejection + 5 audit assertions = 47 tests, wired into `npm run verify` via `test:matrix`.
- Files changed: `vitest.matrix.config.ts` (NEW — own project, `fileParallelism: false` for the shared scratch DB), `tests/matrix/global-setup.ts` (NEW — spawn/readiness/teardown with detached group-kill fallback), `tests/matrix/helpers.ts` (NEW — pg pool, login cookie capture, fixtures, audit + cleanup helpers), `tests/matrix/matrix.spec.ts` (NEW — the status table + 401 row set), `tests/matrix/guard-cases.spec.ts` (NEW — design §9 cases + deputy + FK), `tests/matrix/audit.spec.ts` (NEW — one row per roles mutation, shapes + actor), `package.json` (+`test:matrix`, wired into `verify` between `npm test` and `test:e2e`).
- Review findings breakdown: 1 patched (low: teardown SIGKILL fallback orphaned `next start` on the hung-graceful path → detached process group + group SIGKILL), 1 rejected (low: deputy-case status wording — the fix is editing this build's plan; the deviation is recorded in the Plan Change Log instead). 0 deferred. The lens also verified positively: the config-extension toolchain behavior, MATRIX_* env propagation to workers, every matrix cell derivation, audit shapes, and dev-DB isolation.
- Follow-up review recommendation: **false** — no high findings and fewer than two mediums were patched (one low).
- Verification performed (by the run itself, not only the implementer): `npm run verify` exit 0 twice (initial + post-patch) — build ✓, lint prints "[verify] lint reported issues — non-gating" (74 pre-existing template problems), vitest 29/29, matrix 47/47, e2e 2/2; standalone `npm run test:matrix` green (3 files / 47 tests, boots 4312 against its own scratch DB); `npx vitest run` 29/29 with matrix files not discovered; flip check — Editor `GET /api/users` 200→403 temporarily edited → exactly 1 failed test (`op1 … as editor`), 46 passed → reverted; dev DB roles+users md5 byte-identical before/after every run; `rbac_test_%` empty and ports 4311/4312 free after every run.
- Residual risks: the group-kill fallback branch is code-verified but never exercised by a healthy run (by design); vitest prints a cosmetic `ESM syntax in a file loaded as CommonJS` warning for the `.ts` config extension (loads correctly under the installed Vite/vitest; would need `.mts` if a future default configLoader changes); the 409-last-holder case is unreachable over HTTP by construction — recorded with its proof in the inventory, with the pure suite (src/lib/permissions.test.ts:228-259) pinning the computation and the deputy case proving the guard's reachable face.


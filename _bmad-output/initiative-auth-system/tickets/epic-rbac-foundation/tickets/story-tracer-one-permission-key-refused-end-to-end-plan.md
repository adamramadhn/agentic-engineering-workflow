---
title: 'Tracer: one permission key refused end to end'
type: 'feature'
ticket: '1'
created: '2026-11-03'
status: 'built'
baseline_revision: '7f2926ef807c689e1c4ba7b54645af0b8e7ef1c0'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Authorization does not exist: `users.role` is free text, permission keys are undefined, and GET /api/users only checks "is signed in" — any Active user can list the directory.

**Approach:** Land the tracer for `users.view`: a pure 11-key permission catalog with wildcard resolver (`src/lib/permissions.ts`), schema v3 in `ensureSchema()` (roles + role_audit + FK + 3 system-role seed), `SessionUser.permissions` resolved per request via a roles JOIN, the `me` payload growing `permissions`, and `requirePermission("users.view")` on GET /api/users only. Vitest arrives with the resolver unit suite.

## Boundaries & Constraints

**Always:**
- Seeded role keys are exactly `Admin`/`Editor`/`Member` (existing `users.role` values) — FK lands with zero data migration; no `UPDATE users` statement.
- Schema v3 statements are idempotent (`IF NOT EXISTS`, `ON CONFLICT (key) DO NOTHING`, FK via `pg_constraint` DO-block), appended inside the existing `schemaReady`-cached block.
- `src/lib/permissions.ts` stays pure: no `pg`, no `next/headers`, no server-only imports (client components will import it later). `navigation.ts` may be imported type-only.
- Permissions resolve at request time from the DB join (no JWT claim changes — access token keeps `{sub, email, role, type}`).
- `toSessionUser` callers whose row lacks grants resolve to `[]` (deny-all), never throw.

**Never:**
- No guard on POST /api/users, no role-vs-roles-table validation, no deletion of the `ROLES` const (entry 2's scope).
- No roles API routes (entries 3–4's scope); no UI changes (epic 2).
- No changes to `src/proxy.ts`, JWT claim shape, login/register/refresh/logout flows beyond carrying `role_permissions` in existing row queries.
- No new runtime dependencies; `vitest` is a devDependency.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Anonymous list | GET /api/users, no cookies | 401 `{"error":"Not authenticated"}` | — |
| Member list | signed-in Member (grants lack users.view) | 403 `{"error":"Forbidden","requiredPermission":"users.view"}` | — |
| Admin list | signed-in Admin (`["*"]` → all keys) | 200, `{users:[...]}` | — |
| Wildcard resolve | grants `["*"]` | all 11 concrete keys, no `*` in output | — |
| Resource wildcard | grants `["users.*"]` | the 4 `users.*` keys | — |
| Dead grants | grants `["retired.thing","foo.*","users.view"]` | `["users.view"]` only | — |
| Missing role row | user whose `users.role` matches no `roles` row | permissions `[]` (deny-all), no error | COALESCE in JOIN |
| v2 DB upgrade | existing DB, no roles tables | boot adds roles/role_audit/seed/FK in place | users data untouched |
| Second boot | restart after upgrade | no re-seed, no errors | ON CONFLICT no-op |

</intent-contract>

## Code Map

- `src/lib/permissions.ts` -- NEW, pure catalog: Verb type; `VERBS_BY_PAGE` = home:[view], ask-ai:[view,use], agent-board:[view], watching:[view], users:[view,create,update,delete]; `EXTRA_RESOURCES` = roles:[view,manage]; `PERMISSION_GROUPS` (ordered home, ask-ai, agent-board, watching, users, roles); `ALL_PERMISSION_KEYS` (exactly 11); `PERMISSION_LABELS`; `pageViewPermission(id)` (`permissions` → `roles.view`, else `${id}.view`); `resolvePermissions(granted)`; `hasPermission(resolved, required)`.
- `src/lib/db.ts` -- append schema v3 after the v2 block, same `schemaReady` promise; update header comment to v3.
- `src/lib/auth.ts` -- `UserRow` + `role_permissions?: unknown`; `SessionUser` + `permissions: string[]`; `loadUserByIdRow` SELECT gains `LEFT JOIN roles r ON r.key = u.role` with `COALESCE(r.permissions,'[]'::jsonb) AS role_permissions`; `toSessionUser` calls `resolvePermissions` (non-string entries filtered; absent → `[]`).
- `src/lib/permission-guard.ts` -- NEW, server-only `requirePermission(required): Promise<GuardResult>` per design §5 (`{ok:true,user}` / `{ok:false,response}` with 401 then 403 `requiredPermission`).
- `src/app/api/users/route.ts` -- GET replaces the bare `getSessionUser()` 401 check with `requirePermission("users.view")`; POST untouched except RETURNING grows role grants.
- `src/app/api/auth/login/route.ts` -- SELECT gains the same LEFT JOIN + COALESCE so the login `{user}` payload carries resolved permissions.
- `src/app/api/auth/register/route.ts` -- INSERT RETURNING grows `(SELECT permissions FROM roles WHERE key = $4) AS role_permissions` (role is param 4).
- `src/app/api/auth/me/route.ts` -- unchanged; payload grows via SessionUser (verify only).
- `src/components/dashboard/navigation.ts` -- read-only source of page ids; `NavPageId = (typeof ALL_PAGES)[number]["id"] | "watching"`.
- `src/components/auth/validation.test.mjs` -- legacy node:test file; keep out of the vitest suite via include pattern, do not migrate.
- `vitest.config.ts`, `package.json` -- NEW config + `test: vitest run` script; devDependency `vitest`.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/permissions.ts` -- create the pure catalog, resolver, labels, `pageViewPermission`, `hasPermission` exactly per design §2; TypeScript must fail the build when a nav page id lacks a verbs entry (Record<NavPageId,…>).
- [ ] `src/lib/db.ts` -- append schema v3 (roles, role_audit + index, 3-role seed, users_role_fkey DO-block) per design §3, verbatim SQL; header comment v2→v3.
- [ ] `src/lib/auth.ts` -- join + resolve per Code Map; every `getSessionUser()`/`loadUserById()` caller gains permissions.
- [ ] `src/lib/permission-guard.ts` -- create `requirePermission` per design §5.
- [ ] `src/app/api/users/route.ts` -- guard GET only with `requirePermission("users.view")`; POST INSERT RETURNING gains role grants (param 4 subselect).
- [ ] `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts` -- row queries gain role grants per Code Map.
- [ ] `src/lib/permissions.test.ts` -- NEW unit suite: `*` → all 11; `users.*` → 4 keys; unknown concrete and unknown `foo.*` dropped; dedupe + deterministic catalog order; catalog integrity (every ALL_PAGES id + watching has verbs; every key has a label; no orphan labels; key count is 11).
- [ ] `vitest.config.ts`, `package.json` -- add vitest (devDependency), config with `@`→`src` alias and include `src/**/*.test.{ts,tsx}` (excludes the legacy `.mjs` node:test file), `test` script.

**Acceptance Criteria:**
- Given no auth cookies, when `GET /api/users`, then 401.
- Given a signed-in Member, when `GET /api/users`, then 403 with `requiredPermission: "users.view"`.
- Given a signed-in Admin, when `GET /api/users`, then 200 with the users list.
- Given a signed-in Admin, when `GET /api/auth/me`, then `user.permissions` is the 11 concrete keys (no `*`).
- Given a copy of a v2 database (roles tables absent), when the app boots its first query, then roles/role_audit/seed/FK exist and users data is untouched; when booted a second time, then nothing re-seeds and no error is logged.
- Given `npx vitest run`, then the resolver suite passes (0 failures).

## Implementation Notes

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` `src/lib/db.ts` users_role_fkey existence check matched `pg_constraint` by conname only, so a same-named constraint on another table would silently skip adding the FK — fixed by scoping the check with `AND conrelid = 'users'::regclass`; verified against the live DB that the scoped query still finds the existing constraint (idempotency preserved).
  - `[low]` `[patch]` `src/lib/permissions.test.ts` ALL_PAGES loop asserted `pageViewPermission(page.id) === \`${page.id}.view\`` for every id, contradicting the deliberate `permissions` → `roles.view` override the moment epic 2 adds that nav id — fixed by computing the expected key override-aware (widening `page.id` to string at the comparison after the first attempt tripped TS2367 in `next build`); suite 15/15 and build type-check green.

## Design Notes

- Seed grants: Admin `["*"]`; Editor = the 8 workspace+users-CRUD-minus-delete keys; Member = the 5 view/use workspace keys (watching.view included — design §8-1). Keys: `Admin`, `Editor`, `Member`, `is_system=true`.
- Resolver contract: output NEVER contains `*` or `resource.*`; ordering follows `PERMISSION_GROUPS` then verb order — deterministic for snapshot tests.
- JSONB arrives from pg already parsed (JS value) — do not JSON.parse `role_permissions`.
- `role_audit.actor_id` is nullable (`ON DELETE SET NULL`); `role_key` is not an FK — audit outlives roles.
- Vitest config: `resolve.alias` `{ "@": path.resolve("./src") }`; Node v22, vitest ^5; no jsdom needed (pure unit).
- Verify against the running app on port 3010 (`npm run dev`); register first user → Admin (register rule), create Member/Editor via POST /api/users as Admin (ROLES fallback still present), then sign in as each and curl GET /api/users. If `psql` is unavailable, use a short node script with `pg` for DB assertions.

## Verification

**Commands:**
- `npx vitest run` -- expected: resolver suite green, 0 failures.
- `npm run lint && npm run build` -- expected: clean.
- `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3010/api/users` -- expected: 401 (dev server, no cookies).
- Member/Admin curl flows with cookie jars -- expected: 403 (Member) / 200 (Admin); me payload shows `permissions`.
- `psql`/pg introspection before–after–restart on a v2-copy DB -- expected: tables+FK+seed present, idempotent on re-boot.

**Manual checks (if no CLI):**

## Auto Run Result

**Status: built (first pass, 2026-11-03).**

- **Summary:** The RBAC tracer landed end to end — a pure 11-key permission catalog with wildcard resolver, schema v3 (roles + role_audit + users.role FK + 3 system-role seed) inside `ensureSchema()`, `SessionUser.permissions` resolved per request from a roles JOIN, the `me` payload growing `permissions`, and `requirePermission("users.view")` guarding GET /api/users. Vitest arrived as the unit baseline with the resolver suite.
- **Files changed:**
  - `src/lib/permissions.ts` (new) — pure catalog, resolver, labels, `pageViewPermission`, `hasPermission`.
  - `src/lib/db.ts` — schema v3 block (roles, role_audit + index, seed, FK DO-block scoped by conrelid); header v2→v3.
  - `src/lib/auth.ts` — `SessionUser.permissions`; roles LEFT JOIN + COALESCE in `loadUserByIdRow`; `toSessionUser` resolves grants (absent → `[]`).
  - `src/lib/permission-guard.ts` (new) — `requirePermission()` (401 then 403 `requiredPermission`).
  - `src/app/api/users/route.ts` — GET guarded with `users.view`; POST RETURNING gains role-grants subselect.
  - `src/app/api/auth/login/route.ts`, `src/app/api/auth/register/route.ts` — row queries carry role grants.
  - `src/lib/permissions.test.ts` (new) — 15 tests (resolver, hasPermission, pageViewPermission, catalog integrity).
  - `vitest.config.mts` (new; `.mts` because the package is CJS), `package.json` (+`test` script, vitest devDependency, @types/node ^22), `eslint.config.mjs` (+`.next-dev/**` ignore), `package-lock.json`.
- **Review findings:** Quick lens, 2 findings, both `low` → patched by the implementer: FK guard scoped to `users` via `conrelid`; `pageViewPermission` test loop made override-aware (first fix tripped TS2367 in build, corrected by widening `page.id` to string). 0 deferred, 0 rejected. Patched counts by verdict: low 2, high 0, medium 0.
- **Follow-up review recommended: false** — both patches were low; no high patched and fewer than two medium (first-pass rule).
- **Verification performed:** `npx vitest run` 15/15; `npm run build` exit 0 (type-checks); eslint clean on every changed file (repo-wide `npm run lint` exits 1 from 55 pre-existing errors in files untouched by this diff — present at baseline); live API on 127.0.0.1:3011 (port 3010 held by an unrelated project): anonymous GET /api/users 401, Member 403 `{"error":"Forbidden","requiredPermission":"users.view"}`, Admin 200, Admin `me` shows the 11 concrete keys with no wildcard, Member `me` 5 keys; DB: tables `roles`/`role_audit` present, seed exactly Admin `["*"]` / Editor 8 keys / Member 5 keys, `users_role_fkey` present, audit index present, 0 audit rows (no mutations yet — roles API is entries 3–4); scoped FK check finds the constraint; COALESCE yields `[]` for an unmatched role (deny-all). v2→v3 in-place upgrade and second-boot idempotency were verified by the implementer on a controlled copy of a v2 database (pre-restart edit to the Admin role survived the restart; clean logs) and on the real dev DB (upgraded in place, users untouched).
- **Residual risks:** test fixtures `tracer-a@onyx.dev` (Admin) / `tracer-b@onyx.dev` (Member), password `tracer-password-1`, remain in the dev DB for reuse by later stories (delete if unwanted); this Next's dev daemon caches env at first start, so DB switches need `.env.local` changes rather than env overrides; the 55 pre-existing lint errors remain outside this story's scope.

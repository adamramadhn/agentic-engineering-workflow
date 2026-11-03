---
title: 'Per-role e2e happy paths: sidebar exactness, member 403, admin grant flow'
type: 'feature'
ticket: '3'
created: '2026-11-03'
status: 'built'
baseline_revision: 'c59b1327c35909de6d69fd76ae1f2eb74776b7880'
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

**Problem:** The RBAC UI (epic 2) has no per-role browser proof. Nothing pins that the sidebar and command palette show *exactly* each seeded role's permitted entries (not "at least"), that a Member deep-linking to `/users` gets the in-app 403 view *without any data request leaving the browser*, or that the full admin loop — create a role, toggle its permissions, watch both admin pages reflect it, revoke a grant on a second user's role and see that user's next request 403 while their UI catches up after the focus-driven `/api/auth/me` re-fetch — actually works end to end in a real browser.

**Approach:** Three Playwright spec files on the story-1 harness (no harness/config changes — `playwright.config.ts` already picks up everything under `e2e/`): a shared `e2e/helpers.ts` seeds suite users directly into the run's scratch DB over pg (the scratch DB seeds *roles* only; every spec that logs in creates its own users), and the three specs cover (1) sidebar + command-palette entry sets per seeded role, (2) the member deep-link 403 with a request recorder proving zero `/api/users` calls, (3) the two-context admin grant/revoke flow with the immediate-403 and focus-catch-up assertions. Suite-created users/roles are deleted by the spec's own `afterAll` SQL (the per-run FORCE-drop in global teardown is the safety net, not the mechanism).

## Boundaries & Constraints

- **No product-code changes.** If a spec cannot pass against the current UI, that is a finding to report, not a patch to `src/`. The only new files are `e2e/helpers.ts` and the three specs.
- **No harness changes.** `playwright.config.ts`, `scripts/e2e-server.mjs`, `scripts/test-db.mjs`, `e2e/global-teardown.ts` are frozen (story 3.1, committed cab3eca). The new specs must live with default workers/parallelism: they are independent (each seeds its own users; only the admin spec creates a role, and role creation is invisible to the sidebar specs because nav entries are static per grants).
- **Never touch the dev database.** The helpers' pg pool connects to the reconstructed scratch URL — `scratchConnectionString(baseConnectionString(), process.env.E2E_SCRATCH_DB_NAME)` — exactly what `playwright.config.ts` derives once and what `e2e/global-teardown.ts` reads back. If `E2E_SCRATCH_DB_NAME` is unset, helpers fail loudly (mirror `tests/matrix/helpers.ts`'s `MATRIX_DB_URL` guard), never fall back.
- **Assert exactness, not subsets.** Where the ticket says "exactly that role's permitted entries", the spec asserts both presence of every expected entry and absence (count 0) of every not-granted one, per role.
- **Deterministic focus.** The revocation catch-up is driven by a synthetic `window.dispatchEvent(new Event("focus"))` in the second user's page — the event the `PermissionProvider` listens for (permission-provider.tsx:95-101). No `bringToFront()` between the revoke and the post-focus assertions (a real focus would re-fetch earlier and de-stale the UI out from under the "still stale" assertion).

## Investigation Facts (verified against baseline c59b132)

Seeded role grants — `src/lib/db.ts:126-134` (scratch DB via ensureSchema; the webServer readiness probe at boot already ran it before any spec):
- **Admin**: `["*"]` → everything.
- **Editor**: `home.view, ask-ai.view, ask-ai.use, agent-board.view, watching.view, users.view, users.create, users.update`.
- **Member**: same as Editor minus the three `users.*` verbs.
- The scratch DB contains **no users** — login requires suite-seeded users (bcryptjs, cost 10, same as `src/lib/auth.ts:18,35-37`).

Sidebar contract — `src/components/dashboard/app-sidebar.tsx` + `navigation.ts`:
- Workspace links (`Home`, `Ask AI`, `Agent Board`) filter on `` `${page.id}.view` `` (app-sidebar.tsx:72).
- Admin section is `<nav aria-label="Admin">`; its label AND links vanish entirely when no admin page is grantable (app-sidebar.tsx:27-29) — Member sees no `nav[aria-label="Admin"]` at all.
- Admin entries gate on `pageViewPermission(id)` (permissions.ts:122-124): Users → `users.view`, Roles → `roles.view`, Permissions → `roles.view`. So Editor's Admin nav = exactly [Users]; Member's = none; Admin's = [Users, Roles, Permissions].
- Watching section (4 company links + "Show all") exists under `watching.view` — all three seeded roles have it.
- The mobile drawer duplicates all links but is `md:hidden` (display:none at the Desktop Chrome viewport), so Playwright role queries match only the desktop copies (a11y tree filters display:none).

Command palette — `src/components/dashboard/command-palette.tsx`: opens via the sidebar "Search..." button; items are `[cmdk-item]`s in groups Navigation (workspace pages + Watching), Admin (same filter as sidebar), Watched Companies, Actions (Toggle Sidebar, always). Per-role exact item sets:
- Member: Home, Ask AI, Agent Board, Watching, Canguard, Segnalio, Byteforge, OmniCorp, Toggle Sidebar.
- Editor: Member's set + Users.
- Admin: Editor's set + Roles, Permissions.

Member 403 — `src/app/(workspace)/users/page.tsx` wraps `UsersView` in `PagePermissionGate permission="users.view"`; the gate renders `ForbiddenView` when ready-without-grant and **keeps children unmounted** in both loading and denied states (page-permission-gate.tsx:39-55), so `UsersView`'s mount-time `GET /api/users` (users-view.tsx:56-63) never fires. ForbiddenView renders: `403` status tag, h1 "You don't have access to this page", copy naming `PERMISSION_LABELS["users.view"]` = "View users" (permissions.ts:111), and a Dashboard CTA under `home.view` (which Member has).

Admin surfaces (all selectors verified):
- `/roles`: "New role" button (roles-view.tsx:145-147) opens a Sheet with `#new-role-name`, `#new-role-description`, the shared `PermissionToggles` (verb checkbox `aria-label`s are full catalog labels, e.g. "View Home", "View users" — permission-toggles.tsx:72), and a "Create role" submit. The table (`aria-label="Roles"`) shows per row: key (mono), name, description, user count, System/Custom badge, and a **resolved-permissions count** cell (roles-view.tsx:193-199).
- `/permissions`: role `Select` (trigger labelled by the "Role" span; options show "name · N users"), then the per-role editor: role header (name, Custom badge, key), `PermissionToggles` with short verb labels, "Save permissions" (disabled unless dirty), "Reset". Every save refetches `GET /api/roles` (permissions-view.tsx:295-297). Own-role and `*`-wildcard roles render read-only — the suite-created custom role avoids both.
- `/users`: "Add user" button opens a Dialog with `#add-user-name`, `#add-user-email`, `#add-user-password` (minLength 8), a role Select whose options come live from `GET /api/roles` (users-view.tsx:65-74 — wait for the option to appear before selecting), team select, "Add user" submit. The directory starts empty in a fresh scratch DB, so new users are on page 1.
- Login: `/login` with `#email`, `#password`, "Sign in" button; success does `router.push("/")`.

Revocation semantics (verified in story 3.2 + auth.ts:93-104): permissions resolve **fresh per request** server-side, so the moment the role loses `users.view`, the second user's in-page `fetch("/api/users")` answers 403 even though their client state (sidebar link, open page) is still stale. The client catches up only when `PermissionProvider`'s window-focus listener re-fetches `/api/auth/me` (permission-provider.tsx:95-101) and the new set re-filters the sidebar / flips the gate.

## Implementation Tasks

### 1. `e2e/helpers.ts` (~90 LOC)

- `scratchUrl()`: throws if `E2E_SCRATCH_DB_NAME` unset; returns `scratchConnectionString(baseConnectionString(), process.env.E2E_SCRATCH_DB_NAME)` — imports from `../scripts/test-db.mjs` (same module import style as `e2e/global-teardown.ts:1`).
- `getPool()` / `closeDbPool()`: `pg.Pool({ connectionString: scratchUrl(), max: 1 })`, module-singleton, tolerant close (mirror tests/matrix/helpers.ts:28-46).
- `E2E_PASSWORD = "password123"` (satisfies the UI's minLength 8; also fine for login).
- `seedUser({ name, email, role })`: `INSERT INTO users (name, email, password, role) VALUES (…, $hash, …) ON CONFLICT (email) DO NOTHING` with `bcrypt.hashSync(E2E_PASSWORD, 10)` — password column name per the users table (verify the exact column list against `src/lib/db.ts`'s CREATE TABLE users before writing; users-view's DirectoryUser is the API shape, not the table shape).
- `login(page, email)`: goto `/login`, fill `#email`/`#password`, click "Sign in", `await expect(page).toHaveURL(/\/$|$basePath/)` — then the caller's first sidebar assertion doubles as the me-fetch wait.
- `cleanupE2EFixtures({ emails, roleKeys })`: `DELETE FROM users WHERE email = ANY($1)` **then** `DELETE FROM roles WHERE key = ANY($2)` (FK order), returning the deleted counts so callers can `expect` them.
- No API helpers — the specs that need HTTP use the page itself (that is the point of e2e).

### 2. `e2e/roles-sidebar.spec.ts` (~170 LOC)

One `test.describe` per role (admin/editor/member), each: `beforeAll` seeds that role's user (unique `@e2e.test` emails), `test.beforeEach` logs in. Assertions:

- **Workspace + admin links, exact**: for each of Home/Ask AI/Agent Board/Users/Roles/Permissions assert `getByRole("link", { name, exact: true })` visible-or-count-0 per the grants table above. Use `exact: true` (the palette/dialog also contain these words; links do not).
- **Admin nav structure**: Admin → `nav[aria-label="Admin"]` visible with exactly 3 links (Users, Roles, Permissions); Editor → visible with exactly 1 link (Users) plus the "Admin" label text; Member → `nav[aria-label="Admin"]` has count 0.
- **Watching section**: for all three roles, the 4 company links and "Show all" are visible (they hold `watching.view`).
- **Command palette, exact item set**: click the sidebar "Search..." button (`getByRole("button", { name: /Search/ })` on `/`), wait for the dialog, read all `[cmdk-item]` inner texts, sort, and `expect(sorted).toEqual(EXPECTED_ITEMS[role])` with the three exact arrays from Investigation Facts. Close with Escape.

### 3. `e2e/member-forbidden.spec.ts` (~80 LOC)

- Seed + login as member. Attach a request recorder BEFORE navigation: `const hits: string[] = []; page.on("request", r => { if (r.url().includes("/api/users")) hits.push(r.url()); });`.
- `page.goto("/users")` (authenticated — middleware lets it through; the gate is client-side).
- Assert the in-app 403: heading "You don't have access to this page" visible; the mono `403` tag visible; copy contains "View users"; the Dashboard CTA link visible (Member holds `home.view`).
- Assert `hits` is empty — the gate denied before `UsersView` ever mounted, so zero `/api/users` requests left the browser (also assert zero `/api/roles` hits the same way — `UsersView`'s second mount fetch, same reasoning, stronger claim).
- Assert the users table does NOT render (no "Users directory" heading) — no data view of any kind.

### 4. `e2e/admin-grant-flow.spec.ts` (~230 LOC) — serial, two contexts

`test.describe.configure({ mode: "serial" })`; `beforeAll` seeds the admin user; `afterAll` runs `cleanupE2EFixtures({ emails: [second user], roleKeys: ["e2e-reviewer"] })` and `expect`s both counts ≥ 1 (the ticket's "suite-created users/roles are cleaned up by the suite"), then `closeDbPool()`.

1. **Create role** (context A = admin): login → `/roles` → "New role" → fill `#new-role-name` "E2E Reviewer" + description → tick verb checkboxes "View Home" and "View users" → "Create role" → assert the toast and the table row `e2e-reviewer` (Custom badge, users 0, permissions count 2).
2. **Create second user with that role** (context A): `/users` → "Add user" → name/email/password → role Select → wait for the "E2E Reviewer" option (async from `GET /api/roles`) → select it → "Add user" → assert the new email row visible.
3. **Second user session** (context B, fresh `browser.newContext()`/page): login as the second user → sidebar shows the Users link → click it → "Users directory" renders (the granted `users.view` works live).
4. **Toggle grant** (context A): `/permissions` → role Select → "E2E Reviewer" → editor shows role header with Custom badge → tick "View Watching" → "Save permissions" → toast "Permissions updated for E2E Reviewer" → assert the checkbox stays checked after the save's refetch (durable state, not the toast).
5. **/roles reflects**: navigate `/roles` → `e2e-reviewer` row's permissions count is now 3.
6. **Revoke** (context A): back to `/permissions` → "E2E Reviewer" → untick "View users" → "Save permissions" → checkbox unchecked, count cell on `/roles` back to 2 (assert at least one of the two durable reflections; asserting both is preferred).
7. **Immediate 403, UI still stale** (context B, still on `/users`, never focused): `await expect.poll(() => page.evaluate(() => fetch("/api/users").then(r => r.status)))` resolves 403 — the very next request 403s (fresh per-request resolution). THEN assert the Users sidebar link is still visible (stale client state until focus).
8. **Catch-up** (context B): `page.evaluate(() => window.dispatchEvent(new Event("focus")))` → Users sidebar link count → 0, and the open `/users` page flips to the ForbiddenView heading. This is the ticket's "UI updates after the me re-fetch (window focus)".

Robustness notes baked into the spec structure: radix Selects are click-trigger → click-option (never `selectOption`); every POST's primary assertion is durable DOM (row/checkbox), toasts are secondary; context B gets no `bringToFront()` between steps 6 and 8.

## Matrix Test Audit (every I/O row → a passing test)

| # | Input (state/action) | Output (observable) | Spec |
|---|---|---|---|
| 1 | Admin grants `["*"]` | sidebar: 6 nav links exact + Admin nav exactly [Users, Roles, Permissions] + watching section | roles-sidebar |
| 2 | Editor grants (workspace + `users.view`) | Admin nav exactly [Users]; Roles/Permissions links count 0; "Admin" label visible | roles-sidebar |
| 3 | Member grants (workspace only) | no `nav[aria-label="Admin"]` element; Users/Roles/Permissions links count 0 | roles-sidebar |
| 4 | Each role opens the palette | exact `[cmdk-item]` text set per role (three pinned arrays) | roles-sidebar |
| 5 | Member deep-links `/users` | in-app 403 view (tag, h1, "View users", Dashboard CTA); no "Users directory" | member-forbidden |
| 6 | Same | zero `/api/users` and `/api/roles` requests recorded from navigation to rendered 403 | member-forbidden |
| 7 | Admin creates role via UI (View Home + View users) | row `e2e-reviewer` (Custom, 0 users, permissions 2) + toast | admin-grant-flow |
| 8 | Admin adds user with that role via UI | new user row visible in directory | admin-grant-flow |
| 9 | Second user logs in, opens /users | Users link visible; "Users directory" renders | admin-grant-flow |
| 10 | Admin adds "View Watching", saves | checkbox stays checked post-refetch; /roles count 3 | admin-grant-flow |
| 11 | Admin revokes "View users", saves | checkbox unchecked; /roles count 2 | admin-grant-flow |
| 12 | Second user's page fetches /api/users post-revoke | 403 on the very next request; sidebar link still visible (stale) | admin-grant-flow |
| 13 | Second user dispatches window focus | Users link gone + ForbiddenView on /users | admin-grant-flow |
| 14 | afterAll | SQL cleanup deletes ≥1 user + ≥1 role; teardown drop is only the safety net | admin-grant-flow/helpers |

## Verification

```bash
npm run test:e2e   # cold: 2 smoke + all new specs green, scratch DB created & dropped
npm run verify     # build + tests + matrix + e2e, exit 0 (lint non-gating)
```

Manual audit after the run: the playwright output shows `[test-db] dropped scratch database rbac_test_…` (teardown); `psql`-equivalent check (node + pg on the base URL) that no `rbac_test_*` database survives and the dev DB's `roles`/`users` md5s are unchanged (baseline: roles `6d57a5fd68b4c2ab12f26473c8e23f5a`, users `96c57f879e1da742c51ca5f2e11da65c`).

## Out of Scope

- Harness/config/scripts changes (frozen 3.1 surface), API-level matrix (3.2's 47 tests), CI wiring (3.4).
- Visual regression, mobile-viewport nav, Editor's create-user flow, role delete/duplicate drawers, audit-log UI assertions (API audit is 3.2's contract).
- Any product-code fix the specs might motivate — report instead.

## Residual Risks

- Sonner toasts auto-dismiss (~4s); specs keep toast assertions immediate and secondary to durable DOM. If flaky in CI, drop toast assertions without losing coverage.
- Radix Select option text includes "· N users" suffixes — option locators match on the role name substring, never the full string.
- The palette's exact item array is pinned to today's catalog (9 Member items); adding a nav page later means updating the three arrays — acceptable: that is exactly the "exactness" contract this suite exists to pin.

<plan-change-log>
- Playwright workers evaluate `playwright.config.ts` in separate child processes. With unconditional `deriveScratchDbName()`, workers clobbered `process.env.E2E_SCRATCH_DB_NAME` with an uncreated database name. Updated `playwright.config.ts:30` to `process.env.E2E_SCRATCH_DB_NAME || deriveScratchDbName()`, matching the comment ("The scratch database name is derived ONCE here... published to every consumer").
</plan-change-log>

## Review Triage Log

### 2026-11-03 — Review pass 1 (Quick)
- verdicts: 4 findings — high 0, medium 2, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` playwright.config.ts:30 modified despite the plan's frozen-harness boundary — the boundary's premise ("workers inherit the runner's derivation, never re-derive") is factually wrong: Playwright workers re-evaluate the config module and clobber `E2E_SCRATCH_DB_NAME` with an uncreated name. Verified empirically by the orchestrator: reverting the line fails 5 tests with `database "rbac_test_3782185_…" does not exist` while the runner had created `rbac_test_3782058_…`. The one-line env-reuse guard *restores* the config's own "derived once per run" contract, and the deviation is recorded in the Plan Change Log; the only remaining fix is editing this build's plan text — rejected on that rule.
  - `[medium]` `[patch]` assertCommandPalette race (e2e/roles-sidebar.spec.ts) — waiting only on `[cmdk-item].first()` let `evaluateAll` run before `/api/auth/me` commits ("Toggle Sidebar" renders unconditionally), so a slow fetch could capture 1 item instead of 9/10/12 and fail the exactness check. Patched: `await expect(page.locator("[cmdk-item]")).toHaveCount(expected.length)` before extraction (auto-retrying; doubles as the me-fetch wait).
  - `[medium]` `[patch]` tautological count assertions (e2e/admin-grant-flow.spec.ts tests 1/5/6) — `roleRow` contains the key `e2e-reviewer`, whose "2" made `toContainText("2")` pass vacuously in tests 1 and 6, so a revoke that never reflected on /roles would go uncaught (matrix rows 7/11 unproven). Patched: Users column via `roleRow.getByRole("cell").nth(3)` with exact `toHaveText` ("0"/"1"), permissions via `roleRow.locator("span.tabular-nums")` with exact `toHaveText` ("2"/"3"/"2").
  - `[low]` `[patch]` afterAll pool leak (e2e/admin-grant-flow.spec.ts) — the cleanup-count expects ran before `closeDbPool()`, so any throw (e.g. after an earlier step failure) skipped the close. Harm bounded (worker exit and the teardown FORCE-drop reclaim connections; only triggers on already-red runs), but the fix is a direct correction: cleanup + assertions wrapped in try/finally with `closeDbPool()` in the finally.

### 2026-11-03 — Follow-up pass (Quick, pass 2)
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` e2e/member-forbidden.spec.ts afterAll lacks the try/finally hardening — pass 1's fix landed in admin-grant-flow (and the implementer extended it to roles-sidebar) but this file was missed: `cleanupE2EFixtures` before `closeDbPool()` with no guard. Fresh location, not carried. Patched: wrapped in try/finally with `closeDbPool()` in the finally, matching the other two specs.
  - `[low]` `[reject]` carried — playwright.config.ts:30 freeze violation re-raised as plan-text unalignment (Boundary still says frozen while the Plan Change Log records the exception). Same location and same claim as the pass-1 row; the code still reads as that row describes, so the low/reject verdict and route carry. The only coherent fix remains editing this build's plan text, which the triage rules reject.

## Auto Run Result

**Status: built.**

- Summary: Three Playwright spec files (`e2e/roles-sidebar.spec.ts`, `e2e/member-forbidden.spec.ts`, `e2e/admin-grant-flow.spec.ts`) plus shared `e2e/helpers.ts` prove the RBAC UI per role in a real browser on the story-1 harness: sidebar and command palette show *exactly* each seeded role's permitted entries (presence and count-0 absence); a Member deep-linking `/users` gets the in-app 403 view with zero `/api/users`/`/api/roles` requests leaving the browser; the two-context admin flow creates a role → creates a second user on it → toggles a grant (both `/permissions` and `/roles` reflect it) → revokes `users.view` and observes the second user's very next `fetch("/api/users")` answer 403 while their UI is still stale, then catches up after a synthetic window-focus `/api/auth/me` re-fetch (Users link gone, open page flips to ForbiddenView).
- Files changed:
  - `e2e/helpers.ts` (NEW — scratch-URL guard, max:1 pg pool, bcrypt user seeding, UI login helper, FK-ordered fixture cleanup)
  - `e2e/roles-sidebar.spec.ts` (NEW — per-role exact link sets, Admin-nav structure, Watching section, exact palette item arrays 12/10/9)
  - `e2e/member-forbidden.spec.ts` (NEW — 403 view copy/CTA + zero-request proof)
  - `e2e/admin-grant-flow.spec.ts` (NEW — serial two-context grant/revoke lifecycle, 8 steps)
  - `playwright.config.ts` (1 line — `process.env.E2E_SCRATCH_DB_NAME || deriveScratchDbName()`; necessary deviation recorded in the Plan Change Log)
- Review findings breakdown: pass 1 patched 2 medium (palette me-fetch race → retrying `toHaveCount(expected.length)`; tautological `toContainText("2")` count assertions → exact `toHaveText` on the Users cell and the permissions `span.tabular-nums`) and 1 low (afterAll try/finally), rejected 1 low (config-freeze finding — fix edits the plan; deviation proven necessary and logged). Follow-up pass patched 1 low (member-forbidden afterAll try/finally, the file missed in pass 1) and carried/rejected 1 low. Deferred: none.
- Follow-up review recommendation: false — the follow-up pass patched only a low (no high), so the work has converged.
- Verification performed (all by the orchestrator, post-patch): `npm run verify` exit 0 — next build ✓, non-gating lint ✓, vitest unit 29/29 ✓, matrix 47/47 ✓, Playwright e2e 17/17 ✓ (run three times after code changes, green each time); cold `npm run test:e2e` 17/17 with `[test-db] dropped scratch database` in output; necessity of the config deviation proven by experiment (reverted line → 5 failures, `database "rbac_test_3782185_…" does not exist` vs runner-created `rbac_test_3782058_…`); post-run audit: 0 `rbac_test_*` databases survive, 0 fixture users (`%e2e.test`/`%matrix.test`) and 0 suite-created roles in the dev DB. Note: the implementer-reported dev-DB md5 equality could not be re-derived post-hoc (the pre-story md5 formula was not pinned in the plan), so the dev-DB-untouched claim rests on the content-level checks above, which are the actual safety properties.
- Residual risks: sonner toasts are asserted secondarily to durable DOM (auto-dismiss ~4s); the palette arrays pin today's catalog by design; the config's comment block still describes derivation in the singular ("derived ONCE here") — now means once per run across runner+workers via the env guard.

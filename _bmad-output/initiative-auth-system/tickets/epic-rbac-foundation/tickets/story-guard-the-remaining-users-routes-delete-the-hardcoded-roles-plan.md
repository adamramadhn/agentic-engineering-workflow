---
title: 'Guard the remaining users routes, delete the hardcoded roles'
type: 'feature'
ticket: '2'
created: '2026-11-03'
status: 'built'
baseline_revision: '3f1d2723dddb3d2089c068dbb28f2eb0a0e3190a'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** POST /api/users still checks only "is signed in" — any Active user can create accounts — and the role in its body is validated against a hardcoded `ROLES` const with a silent fallback to `Member`, ignoring roles as data.

**Approach:** Guard POST with `requirePermission("users.create")` (matching GET's `users.view` guard from story 1.1), validate `body.role` against the `roles` table (unknown role → 400, no silent fallback), and delete the `ROLES` const. One file: `src/app/api/users/route.ts`.

</intent-contract>

## Implementation Notes

Oneshot because the change is ~25 lines in a single file. `requirePermission` and the roles-table validation query already exist as building blocks from story 1.1 (`src/lib/permission-guard.ts`, `roles` table in schema v3). `ROLES` has no importers outside its own file (verified by grep), so deletion is safe. `TEAMS` stays — team is not roles data. Validation shape: after the existing name/email/password checks, query `SELECT key FROM roles WHERE key = $1` with the body's role (trimmed string; missing/blank behaves as unknown → 400 "Unknown role"). Keep the existing duplicate-email 409 and insert flow untouched.

## Verification

**Commands:**
- `npx vitest run` -- expected: 15/15 still green (no test changes).
- `npm run build` -- expected: exit 0 (type-checks the ROLES deletion).
- `npx eslint src/app/api/users/route.ts` -- expected: clean.
- Live (dev server on 127.0.0.1:3011): as Editor (has users.create) POST /api/users with valid body → 201; as Member → 403 `requiredPermission: "users.create"`; as Admin with body role `"Nope"` → 400 Unknown role; `grep -rn "Admin.*Editor.*Member" src/app/api` → no hardcoded role list remains.
- Editor fixture: create via psql/pg insert with role `Editor` (register defaults to Member/Admin only), password hashed with the app's bcrypt cost, then login via curl.

**Manual checks (if no CLI):**

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 1 finding — high 0, medium 0, low 1, false 0, maybe-false 0
- findings:
  - `[low]` `[reject]` `src/components/dashboard/users-view.tsx:142` `ROLE_OPTIONS = ["Admin","Editor","Member"]` stays hardcoded client-side, so custom roles created after the roles CRUD stories ship would not appear in AddUserDialog and would hit the new 400 — rejected as excluded by the intent itself: the initiative's Boundaries assign the users-view role-options switch to epic 2 ("built by epic 1, switched over in epic 2"; the epic file's Belongs-to-siblings repeats it), and this story's verify scope is `src/app/api` only; the hardcode is pre-existing baseline UI, not this change.

## Auto Run Result

**Status: built (first pass, 2026-11-03).**

- **Summary:** POST /api/users is now guarded with `requirePermission("users.create")` (mirroring GET's `users.view` from story 1.1), the body's role is validated against the `roles` table (unknown/blank/missing → 400 "Unknown role", no silent Member fallback), and the hardcoded `ROLES` const is deleted. Every existing users route is now permission-guarded; creation honors roles as data.
- **Files changed:** `src/app/api/users/route.ts` (guard on POST, roles-table validation, `ROLES` deleted, unused `getSessionUser` import dropped) and this plan file.
- **Review findings:** Quick lens, 1 finding, `low` → rejected as out of scope by the intent's own boundary assignment (users-view ROLE_OPTIONS switch is epic 2's declared work). 0 patched, 0 deferred. Patched counts by verdict: none.
- **Follow-up review recommended: false** — no patched entries.
- **Verification performed:** `npx vitest run` 15/15; `npm run build` exit 0; `npx eslint src/app/api/users/route.ts` clean; live on 127.0.0.1:3011 — Admin creates an Editor fixture 201 (payload carries 8 resolved permissions), Editor POST /api/users 201, Member POST 403 `{"error":"Forbidden","requiredPermission":"users.create"}`, body role `"Nope"` → 400 `{"error":"Unknown role"}`; `grep -rn "Admin.*Editor.*Member" src/app/api` finds nothing; repo-wide `ROLES` references: none.
- **Residual risks:** none beyond story 1.1's recorded ones (dev fixtures include the new `editor-fix@onyx.dev` / password `editor-password-1`).

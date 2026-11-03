---
title: 'Roles API: rename, delete with blocks, grant replace + lockout guards'
type: 'feature'
ticket: '4'
created: '2026-11-03'
status: 'built'
baseline_revision: '4fc0f98ce737102a341536a8eb37660c4a27e14c'
route: 'full'
route_source: 'auto'
risk: 'high'
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

**Problem:** The roles API can list and create but not mutate — roles cannot be renamed, described, deleted, or have their grants edited, and none of the safety rails (own-role edit, in-use delete, last-`roles.manage` strip) or audit coverage for mutations exist.

**Approach:** Add `PATCH /api/roles/[key]` (rename/describe; key immutable; 404 unknown), `DELETE /api/roles/[key]` (409 system role; 409 + userCount when in use; audit), and `PATCH /api/roles/[key]/permissions` (full-set replace; `isValidGrant` validation 400; own-role edit 403; last-`roles.manage` strip 409 via a pure, unit-tested lockout computation; audit with before/after). All under `roles.manage`; every mutation writes its audit row.

## Boundaries & Constraints

**Always:**
- Dynamic-route signature per this Next's bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`): `{ params }: { params: Promise<{ key: string }> }` and `await params` in every `[key]` handler (constraint C5).
- Guard order in the permissions route: 404 unknown key → 403 own-role (`key === guard.user.role`) → 400 validation → 409 lockout → mutate.
- The lockout computation is a pure exported function in `src/lib/permissions.ts`, unit-tested; the route feeds it queried data (roles with grants + per-role user counts).
- Audit rows for every successful mutation: `role.updated` (`{ before, after }` of name/description), `role.deleted` (`{ name }`), `role.permissions.replaced` (`{ before, after }` grant arrays); sequential, logged-not-fatal.
- No mutation happens before every check passes; 400/403/404/409 paths never write.

**Never:**
- No key changes on rename (URL key is the only identity; body `key` ignored); no partial-grant merge protocol (full-set replace only).
- No UI, no changes to 1.3's GET/POST behavior, the users routes, the catalog key set, the seed, or `src/proxy.ts`.
- No cross-role-file imports; small local mapping helpers may duplicate 1.3's (entry 5's sweep consolidates shared helpers — the epic's own sequencing note).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Rename | PATCH [key] {name:"Support Tier 1"} on `support` | 200; name updated; URL key `support` still resolves on subsequent GET | — |
| Rename 404 | PATCH [key] on `ghost` | 404 | — |
| Rename no-op | PATCH [key] {} or only unknown fields | 400 (nothing to update) | — |
| System rename | PATCH [key] {description} on `Member` | 200 (name/description editable on system roles) | — |
| Delete system | DELETE [key] on `Admin` | 409 "System roles cannot be deleted" | — |
| Delete in use | DELETE [key] on a role with userCount > 0 | 409 with userCount + reassign guidance | — |
| Delete free | DELETE [key] on custom role with 0 users | 200; row gone; audit `role.deleted` | — |
| Delete 404 | DELETE [key] on `ghost` | 404 | — |
| Own-role edit | PATCH [key]/permissions where key === caller's role | 403 (kills self-escalation and self-lockout) | — |
| Bogus replace | PATCH permissions {permissions:["users.view","nope.key"]} | 400, grants unchanged | — |
| Missing array | PATCH permissions {} | 400 | — |
| Lockout | replace that leaves zero users holding roles.manage across all roles | 409 | defense-in-depth; unreachable via guards 1+2 in practice |
| Replace ok | Admin replaces Member's grants to add users.view | 200; a signed-in Member's next request reflects it, no re-login | request-time resolution |
| Unknown role | PATCH/DELETE on `ghost` | 404 before any guard side effects | — |

</intent-contract>

## Code Map

- `src/app/api/roles/[key]/route.ts` -- NEW. PATCH: `requirePermission("roles.manage")`; `await params`; load role by key (404); body `{ name?, description? }` — at least one present else 400; name (when present) trimmed non-empty else 400; description trimmed string; `UPDATE roles SET name = COALESCE(...), description = COALESCE(...) WHERE key = $1 RETURNING ...` (or read-modify-write in one transaction-free sequence matching repo style); audit `role.updated` with `{ before: {name, description}, after: {...} }`; 200 with role shape (key, name, description, permissions raw, resolvedPermissions, isSystem). DELETE: same guard; 404 unknown; `is_system` → 409 "System roles cannot be deleted"; `SELECT count(*) FROM users WHERE role = $1` > 0 → 409 `{ error, userCount }` with reassign-first message; else `DELETE ... RETURNING name`, audit `role.deleted` `{ name }`, 200 `{ deleted: true }`.
- `src/app/api/roles/[key]/permissions/route.ts` -- NEW. PATCH: `requirePermission("roles.manage")`; 404 unknown; own-role (`key === guard.user.role`) → 403; body `permissions` must be a string[] (400) with every entry `isValidGrant` (400, `invalidPermissions` list); load all roles' grants + per-role user counts in one aggregate query; if `wouldLeaveNoManageHolder(entries, key, newGrants)` → 409 "would remove the last holder of roles.manage"; `UPDATE roles SET permissions = $2::jsonb WHERE key = $1 RETURNING ...`; audit `role.permissions.replaced` `{ before, after }`; 200 with role shape.
- `src/lib/permissions.ts` -- add pure `RoleGrantsUsage { key: string; grants: readonly string[]; userCount: number }` and `wouldLeaveNoManageHolder(entries, editedKey, replacementGrants): boolean`: for each entry resolve (edited entry uses replacementGrants), holders = entries whose resolution includes `roles.manage`, return sum of holders' userCount === 0.
- `src/lib/permissions.test.ts` -- lockout-computation unit cases: sole holder stripped → true; another role still holds (explicit and via `*`) → false; adding manage to a new role → false; zero-count holder role → true; edited role not previously a holder → false when another holder exists.
- `src/lib/permissions.ts` (`isValidGrant`), `src/lib/permission-guard.ts` -- reuse as-is.
- `src/app/api/roles/route.ts` (1.3) -- read-only reference for shape/conventions; do not modify.

## Tasks & Acceptance

**Execution:**
- [ ] `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` -- confirm the dynamic-params Promise signature before writing handlers.
- [ ] `src/lib/permissions.ts` -- add `RoleGrantsUsage` + `wouldLeaveNoManageHolder` (pure).
- [ ] `src/lib/permissions.test.ts` -- lockout unit suite.
- [ ] `src/app/api/roles/[key]/route.ts` -- PATCH rename/describe + DELETE with blocks + audits.
- [ ] `src/app/api/roles/[key]/permissions/route.ts` -- full-set replace with guards 1+3 + audit.

**Acceptance Criteria:**
- Given `support` exists, when `PATCH /api/roles/support {"name":"Support Tier 1"}`, then 200 and `GET /api/roles` still lists it under key `support` with the new name, and one `role.updated` audit row exists.
- Given `DELETE /api/roles/Admin`, then 409 "System roles cannot be deleted"; given a custom role with an attached user, then 409 with that userCount; given a free custom role, then 200 and the row is gone with one `role.deleted` audit row.
- Given an Admin, when `PATCH /api/roles/Admin/permissions` (their own role), then 403 and grants unchanged.
- Given `PATCH /api/roles/support/permissions` with `"nope.key"` in the array, then 400 and grants unchanged.
- Given the lockout unit suite, when `npx vitest run`, then every `wouldLeaveNoManageHolder` case passes (the API path itself is deliberately unreachable through guards 1+2).
- Given a signed-in Member (403 on GET /api/users), when an Admin replaces the Member role's grants to include `users.view`, then the Member's very next GET /api/users (same session, no re-login) returns 200; restoring the grants restores 403.
- Given every mutation above, when reading `role_audit`, then each leaves exactly one row with the right action and actor.
- Given `npx vitest run`, then the whole suite passes (22 existing + lockout cases).

## Implementation Notes

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass (quick, pinned)
- verdicts: 1 finding — high 0, medium 1, low 0, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` both new PATCH handlers lacked an empty-RETURNING guard after their UPDATE, so a concurrent DELETE of the same role (between the handler's SELECT and UPDATE) made `result.rows[0]` undefined — PATCH rename 500'd (and mislabeled the throw as an audit failure), and PATCH permissions committed a phantom `role.permissions.replaced` audit row for a mutation that never happened before 500ing — patched by the same implementer with `rows.length === 0 → 404` guards placed BEFORE the audit writes in both handlers, plus the sibling DELETE hardening the reviewer offered (count-then-delete made atomic via `DELETE … WHERE key = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE role = $1) RETURNING name`, with a count re-read disambiguating in-use 409 vs concurrent-delete 404); verified: vitest 29/29, build exit 0, eslint clean, live regression all paths (200/400/403/404/409) and exactly one audit row per successful mutation with zero rows on any failure path.
- everything else the reviewer probed survived independent scrutiny: lockout aggregate query faithful (LEFT JOIN + COUNT(u.id), JSONB NOT NULL, toStringArray degradation matches request-path filtering), audit diffs correct in all three actions, guard order exactly as planned with the 409-lockout unreachability argument confirmed structurally (own-role guard + FK-guaranteed self-count ⇒ holders ≥ 1), COALESCE rename semantics correct including empty-string description clearing.

## Design Notes

- Guard 3 data: one aggregate query — roles LEFT JOIN users grouped (reuse 1.3's GET query shape) — gives key, permissions, user_count for every role in one round trip; the edited role's row is replaced by `replacementGrants` inside the pure function.
- Replacing grants of a role that holds `*` (e.g. Admin) is guarded by guard 1 for self-edits; another admin-style role would count via resolution — the pure function resolves wildcards, so `*` counts as holding roles.manage.
- Fixture plan (verify): reuse `support`/`support-2` and the `tracer-*` users; attach a user to a custom role via `POST /api/users` with `role: "support"` (entry 2's validation); restore Member's seed grants after the immediate-effect check.
- Audit `diff` for `role.updated` carries only the fields that define the update (name/description before+after), matching design §5's `{ before, after }`.

## Verification

**Commands:**
- `npx vitest run` -- expected: all green (existing 22 + lockout suite).
- `npm run build` -- expected: exit 0.
- `npx eslint src/app/api/roles src/lib/permissions.ts src/lib/permissions.test.ts` -- expected: clean.
- Live on 127.0.0.1:3011 (admin jar /tmp/cj-admin.txt; re-login fixtures as needed): rename 200 + key stable; delete Admin 409; delete in-use 409 + count; delete free role 200; own-role permissions edit 403; bogus replace 400; Member grant replace → next-request 200 then restore → 403; `role_audit` row per mutation (pg check).

**Manual checks (if no CLI):**

## Auto Run Result

**Status: built (first pass + 1 patch, 2026-11-03).**

- **Summary:** The roles API's full mutation surface. `PATCH /api/roles/[key]` (`roles.manage`) renames/re-describes (key immutable, body `key` never read, 404 unknown, 400 on nothing-to-update/blank name; system roles editable); `DELETE /api/roles/[key]` blocks system roles (409) and in-use roles (409 with `userCount` + reassign guidance), deletes free custom roles atomically (`NOT EXISTS` guard), each action audited. `PATCH /api/roles/[key]/permissions` full-set-replaces grants behind the planned guard chain — 404 unknown → 403 own-role → 400 `isValidGrant` with `invalidPermissions` → 409 last-`roles.manage` lockout via the new pure, unit-tested `wouldLeaveNoManageHolder` (7 cases; API path structurally unreachable through guards 1+2, exactly as designed) — then updates and audits `role.permissions.replaced` with before/after. Grant changes take effect on holders' very next request with no re-login (proven live: Member 403 → replace → 200 → restore → 403 on one session).
- **Files changed:** `src/app/api/roles/[key]/route.ts` (new, 200 LOC), `src/app/api/roles/[key]/permissions/route.ts` (new, 164 LOC), `src/lib/permissions.ts` (+`RoleGrantsUsage`, +`wouldLeaveNoManageHolder`), `src/lib/permissions.test.ts` (+7 tests, suite now 29), this plan file. Dynamic-route signature read from and matched to the forked Next's bundled docs (`{ params }: { params: Promise<{ key: string }> }` + `await params`).
- **Review findings:** Quick lens, 1 finding, `medium` → patched: empty-RETURNING race after UPDATE (500s + a phantom audit row in the permissions route) closed with 404 guards before the audit writes, and DELETE's count-then-delete made atomic (`NOT EXISTS` + count re-read disambiguation). 0 deferred, 0 rejected. Patched counts by verdict: medium 1.
- **Follow-up review recommended: false** — one medium patched; the rule requires a high or two mediums.
- **Verification performed:** `npx vitest run` 29/29; `npm run build` exit 0 (both dynamic routes registered); eslint clean on all changed files; live on 127.0.0.1:3011 across two independent sessions (implementer + main): rename 200 with key stable (`support` → "Support Tier 1", `support-2` → "Support Second"), body `key` ignored, ghost 404 ×3, `{}`/whitespace-name/bogus-grant/missing-array 400 ×4 (`invalidPermissions:["nope.key"]`), system rename 200, DELETE Admin/Editor 409 "System roles cannot be deleted", in-use delete 409 `{userCount:1}`, free delete 200 `{deleted:true}` then 404 on re-read, own-role permissions edit 403 with Admin grants still `["*"]`, Member grant replace → same-session next-request 200 → restore → 403; pg checks: Member grants restored to exact seed `["home.view","ask-ai.view","ask-ai.use","agent-board.view","watching.view"]`, every mutation leaves exactly one audit row with caller as actor (role.updated ×3 roles, role.deleted ×2, role.permissions.replaced add+restore), zero audit rows on any failure path including the patched race.
- **Residual risks:** none from this story. Dev-DB fixture drift for later stories: `final-check` consumed by the delete test; `support` renamed "Support Tier 1"; `support-2` renamed "Support Second"; `no-grants` now carries `["users.view"]`; probe users/roles cleaned up. The 409 lockout branch is verified by unit tests only — by design, as guards 1+2 make it structurally unreachable over the API.

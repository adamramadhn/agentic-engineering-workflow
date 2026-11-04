---
title: 'Roles API: list and create'
type: 'feature'
ticket: '3'
created: '2026-11-03'
status: 'built'
baseline_revision: '8d13d61cff9f0b3e55f539d0244f0abf623dfcce'
route: 'full'
route_source: 'auto'
risk: 'medium'
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

**Problem:** Roles exist as database rows but have no API — nothing can list them with their usage or resolved grants, and creating a role requires direct SQL, with no audit trail.

**Approach:** New `src/app/api/roles/route.ts`: GET (guarded `roles.view`) returns every role with `userCount`, raw `permissions`, and `resolvedPermissions`; POST (guarded `roles.manage`) creates a custom role — server-slugified unique key derived from the name, every grant validated as a catalog key or wildcard (else 400), `is_system` always false, one `role_audit` row (`role.created`) written after the insert. A pure `isValidGrant()` helper joins the catalog module so validation is unit-tested.

## Boundaries & Constraints

**Always:**
- Audit write is a sequential `await query(...)` after the mutation; an audit-insert failure is logged (console.error) and does not fail the 201.
- The key is derived server-side only — any client-supplied `key` is ignored.
- POST response includes the same role shape GET returns (key, name, description, permissions, resolvedPermissions, is_system, userCount).

**Never:**
- No PATCH/DELETE routes, no `[key]` dynamic routes, no lockout guards (entry 4's scope).
- No changes to `src/proxy.ts`, the users routes, the catalog's key set, or the seed.
- No UI (epic 2).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member lists | GET /api/roles as Member (no roles.view) | 403 `requiredPermission: "roles.view"` | — |
| Anonymous | GET /api/roles, no cookies | 401 | — |
| Admin lists | GET /api/roles as Admin | 200; seeded 3 roles each with userCount, raw grants, resolvedPermissions (Admin's resolved = all 11 keys, raw `["*"]`) | — |
| Create | POST {name:"Support", permissions:["users.view","watching.view"]} as Admin | 201; key `support`, userCount 0, is_system false, resolvedPermissions = granted keys | — |
| Key collision | role `support` exists, POST {name:"Support"} | 201 with key `support-2` | — |
| Bogus grant | POST {name:"X", permissions:["users.view","banana.peel"]} | 400, no row created | — |
| Unknown wildcard | POST {name:"X", permissions:["foo.*"]} | 400 | — |
| Missing name | POST {permissions:[...]} or name "   " | 400 | — |
| Empty grants | POST {name:"X"} or permissions [] | 201 with permissions `[]` (a role may grant nothing) | — |
| Audit | after a successful create | one role_audit row: actor_id = caller, action `role.created`, role_key = new key, diff has role name + permissions | audit failure logged only |

</intent-contract>

## Code Map

- `src/app/api/roles/route.ts` -- NEW. GET: `SELECT r.key, r.name, r.description, r.permissions, r.is_system, r.created_at, COUNT(u.id)::int AS user_count FROM roles r LEFT JOIN users u ON u.role = r.key GROUP BY r.key, r.name, r.description, r.permissions, r.is_system, r.created_at ORDER BY r.created_at ASC, r.key ASC`; map rows to `{ key, name, description, permissions (raw, JSONB already parsed), resolvedPermissions: resolvePermissions(raw), isSystem, userCount, createdAt }`; respond `{ roles }`. POST: `requirePermission("roles.manage")`; body `{ name?, description?, permissions? }`; name trimmed non-empty else 400; description trimmed string default ""; permissions must be an array of strings, each `isValidGrant` else 400; slugify name (`toLowerCase`, non-alphanumeric runs → single hyphen, trim hyphens; empty slug → 400 "Name must contain letters or numbers"); probe keys `slug`, `slug-2`, `slug-3`… via one `SELECT key FROM roles WHERE key = ANY($1)` style lookup or per-candidate query until free; INSERT with `is_system false` `RETURNING` row + userCount 0 shape; then audit insert; 201.
- `src/lib/permissions.ts` -- add pure `isValidGrant(entry: string): boolean`: true for `"*"`, a known `<resource>.*` (resource in PERMISSION_GROUPS), or a concrete ALL_PERMISSION_KEYS member. No other changes.
- `src/lib/permission-guard.ts` -- reuse as-is (`requirePermission`).
- `src/lib/db.ts` -- read-only: `roles`, `role_audit` tables exist from story 1.1; `query()` awaits `ensureSchema()`.
- `src/lib/permissions.test.ts` -- extend with `isValidGrant` cases (all three true shapes; false: unknown concrete, unknown wildcard, malformed).
- Audit insert (route): `INSERT INTO role_audit (actor_id, action, role_key, diff) VALUES ($1, 'role.created', $2, $3::jsonb)` with diff `{ name, permissions }` snapshot per design §5.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/permissions.ts` -- add `isValidGrant` (pure, exported).
- [ ] `src/lib/permissions.test.ts` -- unit cases for `isValidGrant`.
- [ ] `src/app/api/roles/route.ts` -- create GET + POST per Code Map.
- [ ] Audit write per Code Map (failure logged, not fatal).

**Acceptance Criteria:**
- Given an Admin, when `POST /api/roles {"name":"Support","permissions":["users.view","watching.view"]}`, then 201 and `GET /api/roles` shows `support` with userCount 0 and resolvedPermissions `["users.view","watching.view"]`.
- Given the same POST with `"banana.peel"` among the permissions, then 400 and no role row is created.
- Given a successful create, when reading `role_audit`, then exactly one new row with the caller as actor, action `role.created`, and the new role_key.
- Given a Member, when GET or POST `/api/roles`, then 403 (`roles.view` / `roles.manage` respectively); anonymous GET → 401.
- Given `npx vitest run`, then the suite (15 existing + new isValidGrant tests) passes.
- Given a second `POST {"name":"Support"}`, then 201 with key `support-2`.

## Implementation Notes

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 1 finding — high 0, medium 1, low 0, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` `src/app/api/roles/route.ts` POST derived its key by probe then INSERTed without conflict handling, so two concurrent same-name creates (e.g. a double-clicked Create) turned the loser into a unique-violation 500 instead of the collision contract's 201 with a suffixed key — fixed with `ON CONFLICT (key) DO NOTHING RETURNING` inside a bounded 3-attempt re-derive loop, same 409 fallthrough, and the audit row keyed to the committed row's key; verified live with six simultaneous same-name POSTs → six 201s with distinct contiguous keys and six audit rows, plus sequential-create regression 201/one-audit-row.

## Design Notes

- Slug collisions: probe-and-append (`-2`, `-3`, …) matches design §5 POST row ("Server derives the key: slugified unique name (append -2, -3… on collision)").
- `role_audit.diff` for create is the `{ name, permissions }` snapshot (design §5 audit-writes paragraph).
- Validation precedes any INSERT; the route never mutates on a 400.
- The catalog's resource set for wildcard validation comes from `PERMISSION_GROUPS` (single source of truth — a future catalog entry needs no route change).

## Verification

**Commands:**
- `npx vitest run` -- expected: all green (existing 15 + isValidGrant cases).
- `npm run build` -- expected: exit 0.
- `npx eslint src/app/api/roles/route.ts src/lib/permissions.ts src/lib/permissions.test.ts` -- expected: clean.
- Live on 127.0.0.1:3011 (cookie jars /tmp/cj-admin.txt, /tmp/cj-member.txt exist): Admin POST Support → 201; GET → contains support with userCount 0 + resolvedPermissions; bogus permission → 400; duplicate name → `support-2`; Member GET/POST → 403; anonymous GET → 401; `role_audit` row check via pg.

**Manual checks (if no CLI):**

## Auto Run Result

**Status: built (first pass, 2026-11-03).**

- **Summary:** The roles API's read + create surface: `GET /api/roles` (`roles.view`) returns every role with `userCount`, raw `permissions`, and catalog-resolved `resolvedPermissions`; `POST /api/roles` (`roles.manage`) creates a custom role with a server-slugified collision-safe key (`support`, `support-2`, …), full grant validation (`isValidGrant`, added pure to the catalog module with 7 unit tests), `is_system` false always, and a non-fatal `role_audit` (`role.created`) write keyed to the committed row.
- **Files changed:** `src/app/api/roles/route.ts` (new), `src/lib/permissions.ts` (+`isValidGrant`), `src/lib/permissions.test.ts` (+7 tests, suite now 22), this plan file.
- **Review findings:** Quick lens, 1 finding, `medium` → patched: probe-then-insert race closed with `ON CONFLICT DO NOTHING` + bounded re-derive retry (evidence: six parallel same-name creates → six 201s with distinct keys). 0 deferred, 0 rejected. Patched counts by verdict: medium 1.
- **Follow-up review recommended: false** — one medium patched; the rule requires a high or two mediums.
- **Verification performed:** `npx vitest run` 22/22; `npm run build` exit 0; eslint clean on all three changed files; live on 127.0.0.1:3011 — anonymous GET 401; Member GET/POST 403 (`roles.view` / `roles.manage`); Admin GET 200 (seeded roles with raw vs resolved grants and userCounts 3/2/2); POST `Support` → 201 `support`, recreate → `support-2`, post-fix sequential create → 201 with `final-check` key and matching audit row; bogus permission `banana.peel` → 400 with `invalidPermissions` and no row created; `foo.*` → 400; blank name / slug-empty name (`!!!`) → 400; empty grants → 201 `[]`; role_audit shows exactly one `role.created` row per successful create with caller as actor. (An interim `member-get=401` was the cookie jar's expired 15-minute access token — re-login restored the expected 403.)
- **Residual risks:** none from this story beyond 1.1's; the dev DB carries extra fixture roles (`support*`, `no-grants`, `empty-grants`, `final-check`) and their audit rows — useful fixtures for story 1.4's delete/lockout work; concurrent-create hardening is bounded at 3 attempts with a 409 fallthrough (pathological same-name stampedes beyond that still 409, never 500).

---
type: epic
title: RBAC foundation: catalog, schema, API guards
parent: initiative-auth-system
covers: ["R1", "R2", "R3", "R4", "R7", "R8", "R9"]
sources: []
companions: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
after: []
risk: medium
refined: true
---

# RBAC foundation: catalog, schema, API guards

## Description

The server side of RBAC, complete and deployed with no admin UI yet: the permission catalog in code, roles as database rows seeded with the three system roles, `SessionUser.permissions` resolved at request time, `requirePermission()` on every data API route, the full roles API with lockout guards and audit writes, and the hardcoded role lists deleted. Built from the initiative's lines and the adopted design (§2–§5, §10 steps 1–4).

## Outcome

For the app's users, what each role may do is decided at the API on every request — the design's signal: a revoked grant is refused on the member's next request, with no re-login and no UI shipped yet.

## Done when

- Schema v3 bootstraps idempotently: fresh DB seeds the three system roles; an existing v2 DB gains the FK and seed in place, surviving a restart untouched.
- Every existing and new data API route answers 401/403 per its permission (spot-checked per seeded role).
- The roles API surface works end to end — create, rename, duplicate via create, delete with blocks, full-set grant replace — each mutation leaving an audit row.
- Lockout guards refuse as specified: own-role grant edit 403 and in-use delete 409 with count at the API; the last-`roles.manage` guard is proven by unit test of the lockout computation — its API path is deliberately unreachable through guards 1+2 (design §5, defense-in-depth).
- The resolver unit suite is green on the vitest baseline (this epic's share of R9; the matrix and e2e suites are epic 3's).
- Delivered to the running app: a request from a role without `users.view` is refused by the live API, and an unauthenticated one gets 401.

## Requirements

1. **Catalog-driven gating** (R1, parent R1)
   Every navigation page and admin surface is gated by a permission key defined in one code catalog; adding a new app page requires adding one catalog entry and no database migration.
2. **Roles as data** (R2, parent R2)
   Roles can be created, renamed, described, duplicated and deleted, with grants stored per role; three system roles are seeded idempotently on boot, fresh and existing databases alike. This epic delivers the data layer and the API; the managing UI is epic 2's.
3. **Immediate effect** (R3, parent R3)
   A user's effective permissions derive from their role at request time; a grant or revoke takes effect at the API on the next request, with no re-login.
4. **Server-side enforcement** (R4, parent R4)
   Every data API route enforces its required permission server-side and answers 401/403 accordingly; client-side hiding is never the only barrier.
5. **Lockout-proof and audited** (R7, parent R7)
   Editing your own role's grants, deleting a role still in use, and stripping `roles.manage` from its last holder are all rejected server-side; every roles/permissions mutation writes an audit row (actor, action, diff).
6. **Wildcards resolve, dead grants inert** (R8, parent R8)
   `*` and `resource.*` grants are supported and resolve to concrete catalog keys; unknown or retired grants grant nothing.
7. **Unit altitude of the test plan** (R9, parent R9 — this epic's part)
   The resolver unit suite passes on the vitest baseline this epic adds; the fixture matrix, e2e and CI wiring are epic 3's part (decision 2026-11-03).

## Constraints

The parent's that bind this epic (full list there, C1–C7):

- C1: `src/proxy.ts` stays auth-only and edge-safe — no `pg` import; enforcement lives in the API layer.
- C2: zero new runtime dependencies — no Casbin/CASL/permit.io (`vitest` is a devDependency, not runtime).
- C3: the `users.role` column is not migrated; seeded keys equal the existing `Admin`/`Editor`/`Member` values so the FK lands with zero data migration.
- C4: permission keys (`resource.action`) are stable identifiers forever; labels are the i18n surface.
- C5: Next 16 dynamic route params are Promises — `await params` in every `[key]` handler.
- C6: schema v3 rides the existing idempotent `ensureSchema()` pattern in `db.ts`.

## Boundaries

- Owns: `src/lib/permissions.ts` (new), `src/lib/db.ts` schema v3, `src/lib/auth.ts` (permissions join) and the `me` payload's `permissions` growth, `src/lib/permission-guard.ts` (new), `src/app/api/roles/**` (new), guards on `src/app/api/users`, deleting `ROLES`/`ROLE_OPTIONS` constants, the test-runner baseline (vitest) for its stories' tests.
- Must not change: `src/proxy.ts` behavior, JWT claim shape, login/register/refresh flows.
- Belongs to siblings: every UI (epic 2), e2e suites and the fixture-matrix suite (epic 3); `users-view` role options switch to the roles API happens in epic 2.

## References

- parent — `_bmad-output/initiative-auth-system/initiative-auth-system.md`, Requirements R1–R4, R7–R9
- design — `_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md` (§2 catalog, §3 schema v3, §4 auth integration, §5 API layer + guards + audit, §10 build order steps 1–4)

## Notes

- Decision (2026-11-03): sequencing — entries 2 and 3 run in parallel after the tracer (disjoint files: users route vs new roles routes); entry 4 waits on 3 (needs created custom roles as fixtures) and on 2 (needs roles-table validation to attach a user to a custom role for its checks).
- Decision (2026-11-03): the least-certain story is entry 1 (schema change on live data + the security core), which is why it is first; entry 4 sits last by prerequisites, not by certainty.
- Decision (2026-11-03): entry 1 carries hitl = false — no person-run setup step exists (DB env is configured; runner install is agent work); flip it if a manual starter appears.
- Decision (2026-11-03): tracer bullet is entry 1 — `users.view` refused end to end through catalog, schema, session and one guarded route; the thinnest path through every layer this epic touches.
- Decision (2026-11-03): for an unattended build, plan checkpoints on entry 1 (schema + security core) and entry 4 (lockout guards); none elsewhere.
- Decision (2026-11-03): platform baseline lives in this epic's first stories — vitest is added with the catalog's unit tests, ahead of epic 3's suites.
- Decision (2026-11-03): the adopted design doc serves as the architecture spine for all three epics; a `bmad-architecture` run was not taken (no shared decision left open).

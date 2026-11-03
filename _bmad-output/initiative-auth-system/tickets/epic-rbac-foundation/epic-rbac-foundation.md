---
type: epic
title: RBAC foundation: catalog, schema, API guards
parent: initiative-auth-system
covers: ["R1", "R2", "R3", "R4", "R7", "R8", "R9"]
sources: []
companions: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
after: []
risk: medium
refined: false
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
- Each lockout guard refuses as specified: own-role grant edit 403, in-use delete 409 with count, last-`roles.manage` strip 409.
- The resolver unit suite is green on the vitest baseline (this epic's share of R9; the matrix and e2e suites are epic 3's).
- Delivered to the running app: a request from a role without `users.delete` is refused by the live API.

## Boundaries

- Owns: `src/lib/permissions.ts` (new), `src/lib/db.ts` schema v3, `src/lib/auth.ts` (permissions join) and the `me` payload's `permissions` growth, `src/lib/permission-guard.ts` (new), `src/app/api/roles/**` (new), guards on `src/app/api/users`, deleting `ROLES`/`ROLE_OPTIONS` constants, the test-runner baseline (vitest) for its stories' tests.
- Must not change: `src/proxy.ts` behavior, JWT claim shape, login/register/refresh flows.
- Belongs to siblings: every UI (epic 2), e2e suites and the fixture-matrix suite (epic 3); `users-view` role options switch to the roles API happens in epic 2.

## References

- parent — `_bmad-output/initiative-auth-system/initiative-auth-system.md`, Requirements R1–R4, R7–R8
- design — `_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md` (§2 catalog, §3 schema v3, §4 auth integration, §5 API layer + guards + audit, §10 build order steps 1–4)

## Notes

- Decision (2026-11-03): platform baseline lives in this epic's first stories — vitest is added with the catalog's unit tests, ahead of epic 3's suites.
- Decision (2026-11-03): the adopted design doc serves as the architecture spine for all three epics; a `bmad-architecture` run was not taken (no shared decision left open).

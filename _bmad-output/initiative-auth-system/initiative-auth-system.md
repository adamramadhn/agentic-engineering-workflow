---
type: initiative
title: Auth System
parent: none
sources: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
companions: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
after: []
risk: medium
---

# Auth System

## Description

The app's JWT auth (login, refresh rotation, users directory) gains role-based access control: roles become manageable data, permission keys come from one code catalog, enforcement is layered (API as the real gate, sidebar/pages as UX), and two admin pages let an operator decide who sees which menu, opens which page, and performs which actions. Built from the completed brainstorm's build-ready design, adopted beside this ticket.

## Outcome

For the team operating the app, an admin can grant or revoke what each role sees and does (menus, pages, CRUD actions) without code changes or deploys — the design's success signal: a permission change takes effect for a member's very next request, and a member without `users.view` gets a 403, never data (design §9 e2e).

## Requirements

1. **Catalog-driven gating** (R1)
   Every navigation page and admin surface is gated by a permission key defined in one code catalog; adding a new app page requires adding one catalog entry and no database migration.
2. **Roles as data** (R2)
   Roles can be created, renamed, described, duplicated and deleted, with grants stored per role; three system roles are seeded idempotently on boot (fresh and existing databases alike).
3. **Immediate effect** (R3)
   A user's effective permissions derive from their role at request time; a grant or revoke takes effect at the API on the next request, with no re-login.
4. **Server-side enforcement** (R4)
   Every data API route enforces its required permission server-side and answers 401/403 accordingly; client-side hiding is never the only barrier.
5. **Permission-aware navigation** (R5)
   Sidebar, command palette and deep links respect grants: no permission means the menu entry is hidden and the page shows a 403 view, never data.
6. **Two admin pages** (R6)
   An admin manages roles on `/roles` (master CRUD) and grants on `/permissions` (matrix), cross-linked via URL params.
7. **Lockout-proof and audited** (R7)
   Editing your own role's grants, deleting a role still in use, and stripping `roles.manage` from its last holder are all rejected server-side; every roles/permissions mutation writes an audit row (actor, action, diff).
8. **Wildcards resolve, dead grants inert** (R8)
   `*` and `resource.*` grants are supported and resolve to concrete catalog keys; unknown or retired grants grant nothing.
9. **Tested at three altitudes** (R9)
   Resolver unit tests, a per-role API fixture matrix (401/403/409 including lockout guards), and an e2e happy path per role all pass; a test runner is added as prerequisite.

## Constraints

- C1 (design §1): `src/proxy.ts` stays auth-only and edge-safe — no `pg` import; enforcement lives in the API layer.
- C2 (design §1): zero new runtime dependencies — no Casbin/CASL/permit.io.
- C3 (design §3): the `users.role` column is not migrated; seeded role keys must equal the existing values (`Admin`/`Editor`/`Member`) so the FK lands with zero data migration.
- C4 (design §2): permission keys (`resource.action`) are stable identifiers forever; labels are the i18n surface.
- C5 (design §1 facts): Next 16 dynamic route params are Promises — `await params` in every `[key]` handler, per `node_modules/next/dist/docs`.
- C6 (design §3): schema v3 rides the existing idempotent `ensureSchema()` pattern in `db.ts`.
- C7 (design §7 Won't): the parked list is out of scope for v1 — `perm_version`, row/field scoping, user overrides, per-team roles, inheritance, custom-verb UI, external libs, impersonation.

## Done when

- All ten Must items of design §7 are demonstrable in the running app.
- A fresh database boots seeded with the three system roles; an existing v2 database upgrades in place (FK added, seed survives restart untouched).
- The per-role fixture matrix and the per-role e2e paths (design §9) are green.
- A member without `users.view` sees no Users menu, gets the 403 view on `/users`, and the API returns 403 — verified end to end.
- Every roles/permissions mutation has an audit row; each lockout guard returns its specified 403/409.

## Boundaries

- Owned by epic 1 (epic-rbac-foundation): `src/lib/permissions.ts` (new), `src/lib/db.ts` (schema v3), `src/lib/auth.ts` + the `me` payload's `permissions` growth, `src/lib/permission-guard.ts` (new), `src/app/api/roles/**` (new), guards on `src/app/api/users`, the vitest baseline.
- Owned by epic 2 (epic-rbac-admin-experience): `src/components/dashboard/navigation.ts`, sidebar/command palette/dashboard-shell gating, `users-view`'s role-source switch, the new `/roles` and `/permissions` pages.
- Owned by epic 3 (epic-rbac-proof): playwright setup, test DB fixtures, the fixture-matrix and e2e suites, CI wiring for the suites.
- Touch point (consumed only): `users-view` renders role options from `GET /api/roles` — built by epic 1, switched over in epic 2.
- Tracer path: epic 1 (catalog → schema → guarded API) → epic 2 (gated UI + both admin pages on that API) → epic 3 (suites freezing both).
- Must not change: existing auth flows (login, register, refresh rotation, logout), the JWT claim shape, `proxy.ts` routing behavior.
- Out: everything in design §7 Could (presets, audit viewer UI, why-disabled tooltips) unless promoted; the entire Won't list (C7).

## References

- design — `_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md` (adopted companion: §2 catalog, §3 schema v3, §5 API + guards, §6 frontend, §7 scope, §9 testing, §10 build order)
- brainstorm record — `.memlog.md` in the same folder (alternatives and rejection reasons; process record, not a source)

## Notes

- Assumption: `watching.view` is granted to all three system roles; the Watching section, page and future APIs gate on it (design §8-1 default — say the word to override).
- Assumption: verb set per page is `home [view]`, `ask-ai [view, use]`, `agent-board [view]`, `watching [view]`, `users [view, create, update, delete]`, `roles [view, manage]` (design §8-2 default — under-granting now is a one-line fix later).
- Assumption: adding `vitest` + `playwright` as devDependencies is in scope (the repo has no test runner; design §9 prerequisite).

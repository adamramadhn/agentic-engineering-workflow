---
type: epic
title: Permission-aware UI and the two admin pages
parent: initiative-auth-system
covers: ["R5", "R6"]
sources: []
companions: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
after: ["epic-rbac-foundation"]
risk: medium
refined: true
status: done
---

# Permission-aware UI and the two admin pages

## Description

Everything the user and the admin see: `PermissionProvider` + `usePermission` in the dashboard shell, sidebar/command-palette/Watching filtered by grants, the per-page 403 view for deep links, the `/roles` master page (table, drawer, duplicate, delete with blocks), the `/permissions` page (role select → per-resource verb checkboxes) and their URL-param cross-links; `users-view` reads its role options from the roles API. Built on epic 1's API contract (design §6 as revised 2026-11-03, §10 steps 5–6).

## Outcome

For every signed-in user, the app shows exactly what their role permits — the design's signal: a member without `users.view` finds no Users menu and gets the 403 view on the deep link, while an admin tunes menus, pages and actions from two pages.

## Done when

- Sidebar, command palette and the Watching section render exactly the permitted entries for each seeded role in the running app.
- A deep link to a forbidden page shows the 403 view inside the dashboard chrome, never data.
- `/roles` supports create, edit, duplicate, and delete with the same blocks the API enforces; `/permissions` edits the selected role's grants (role select → per-resource verb checkboxes) and reflects changes after save.
- The two pages cross-link via `?role=<key>` in both directions.
- No hardcoded role list remains in `users-view` (options come from `GET /api/roles`).
- Delivered to the running app and verified per seeded role.

## Boundaries

- Owns: `src/components/dashboard/permission-provider.tsx` (new), `navigation.ts` additions, `app-sidebar`/`command-palette`/`dashboard-shell` gating, `forbidden-view` + `PagePermissionGate` (new), `/roles` and `/permissions` pages (new), `users-view` role-source switch.
- Must not change: API contracts or guards (epic 1's), the existing auth pages.
- Belongs to siblings: server-side enforcement and schema (epic 1); the e2e and fixture suites that freeze this behavior (epic 3).

## References

- parent — `_bmad-output/initiative-auth-system/initiative-auth-system.md`, Requirements R5–R6
- design — `_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md` (§6 frontend, §7 Should items, §10 build order steps 5–6)

## Notes

- Decision (2026-11-03): Should-grade items (403 view pattern, matrix mobile collapse, me re-fetch on focus, duplicate button) ride inside this epic's stories rather than a separate epic.
- Decision (2026-11-03, user revision): `/permissions` is a per-role editor — a role selector reveals grouped per-resource verb checkboxes (e.g. `Ask AI | view · use`, `Users | view · create · update · delete`) with one Save for the selected role — replacing the design's roles-as-columns matrix. Sticky header/column, per-column save and the mobile-collapse Should item dissolve; cross-links (`?role=`), the wildcard read-only lock, and own-role blocking carry over. Design §6's matrix subsection is superseded for this epic by this decision.

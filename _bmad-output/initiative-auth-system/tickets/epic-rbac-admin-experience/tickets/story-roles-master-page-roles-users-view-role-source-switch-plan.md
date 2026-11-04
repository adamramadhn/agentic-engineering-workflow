---
title: 'Roles master page /roles + users-view role-source switch'
type: 'feature'
ticket: '2'
created: '2026-11-03'
status: 'built'
baseline_revision: 'ad631b3d35cc3c122887ef9b927ff099ca285646'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 1
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Roles are data with a full audited API (epic 1), but there is no way to manage them in the app — no /roles page exists — and users-view still hardcodes the role world twice (AddUserDialog's `ROLE_OPTIONS` and the role FilterMenu), so custom roles are invisible to user creation and filtering.

**Approach:** The /roles master page (design §6): an RSC page that checks `roles.view` **server-side before querying** (the 2.1 review's flight-payload carry-forward), loads roles + userCount via `query()` for first paint, and hands off to a `RolesView` client island — table (key mono, name, description, # users, system badge, permission count), create/edit drawer with permission toggles grouped by `PERMISSION_GROUPS`, wildcard "All permissions" state with a Customize action, duplicate (prefills create with the source's resolved grants), delete surfacing the API's blocks — every mutation calls the epic-1 API and refetches. `navigation.ts` gains the roles admin entry (gated by story 2.1's `pageViewPermission`). users-view's two hardcoded role lists switch to the roles API (fallback: distinct roles from the loaded directory when `roles.view` is missing — an Editor has `users.create` but not `roles.view`).

## Boundaries & Constraints

**Always:**
- **Server-side gate first** (carry-forward from 2.1's review): the RSC page resolves the session (`getSessionUser`) and checks `roles.view` against the resolved permissions BEFORE any roles query; a forbidden user gets the in-app 403 (no role data in the flight payload). The client `PagePermissionGate` stays as the second layer.
- Drawer saves are full-set replaces exactly as the API defines them; every successful mutation shows a toast and refetches the list via `GET /api/roles` (the island owns its post-mutation state; the RSC props are first paint only).
- `?role=<key>` opens that role's edit drawer on load: the RSC page reads `searchParams` (a Promise in this Next — `await` it per the bundled docs) and passes the key to the island; no client `useSearchParams` (avoids the CSR-bailout class entirely).
- Delete blocks surface the API's own reasons: system roles → delete disabled with explanatory text (no request); in-use → the count + reassign guidance rendered from a prefetch or a 409 response; free → simple confirm, then DELETE.
- users-view's role options: primary source `GET /api/roles` (label = name, value = key); on 403/fetch failure fall back to the distinct `user.role` values of the loaded directory (keys as labels) — never the hardcoded trio. Both the AddUserDialog select and the role FilterMenu use this one source.
- Wildcard display: a role whose raw grants contain `*` renders "All permissions (wildcard)"; Customize swaps the working set to the resolved concrete keys (marked dirty; save = the audited full-set replace). `resource.*` grants render as their group-level state (checked group with indeterminate handling as the toggle UI allows) — the drawer's working set stays raw-grant-faithful.

**Never:**
- No changes to the roles API, guards, audit semantics, catalog, or seed (epic 1 frozen); no /permissions matrix or cross-links beyond `?role=` drawer-open (story 2.3); no new permissions or nav entries other than `roles`; no changes to auth pages or `src/proxy.ts`.
- No client-side wildcard interpretation beyond displaying the resolved array the API already returns (`resolvedPermissions`); the drawer edits raw grants.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin lists | GET /roles as Admin | Table of every role: key, name, description, userCount, system badge, permission count | — |
| Deep link drawer | /roles?role=support | support's edit drawer opens on load | unknown key → list only |
| Member nav | Member sidebar/palette | No Roles entry; deep link /roles → server-gated in-app 403, **no roles query, no role data in flight payload** | — |
| Create | drawer, name + toggled grants | POST → 201, toast, list refetches with the new role (userCount 0); audit `role.created` | 400 (name/invalid grant) → inline error; 409 key exhaustion → toast |
| Rename | edit drawer name/description | PATCH → 200, list refetch shows new name under the same key; audit `role.updated` | 404 (deleted elsewhere) → toast + refetch |
| Grant replace | edit drawer toggles + save | PATCH permissions → 200; resolved state reflects wildcards; audit `role.permissions.replaced` | 400 invalid → inline; 403 own-role → error copy (own role's grants not editable) |
| Wildcard role | Admin role drawer | "All permissions (wildcard)" + Customize → concrete set checked; save replaces `*` | — |
| Duplicate | row action on support | create drawer prefilled: name `Support (copy)` (editable), grants = support's resolved set | — |
| Delete system | row action on Member | Delete disabled + "System roles cannot be deleted" text; no request fired | — |
| Delete in-use | row action on role with users | Count + reassign guidance shown (prefetched count and/or the 409 body); no deletion | 409 → guidance from response |
| Delete free | row action on 0-user custom role | Confirm → DELETE → 200, row gone; audit `role.deleted` | 404 → toast + refetch |
| Editor adds user | Editor opens AddUserDialog | GET /api/roles 403s → options fall back to distinct directory roles; create still works | no empty select, no hardcoded trio |
| Filter roles | role FilterMenu | Options from the same roles source as the dialog | fallback as above |

</intent-contract>

## Code Map

- `src/components/dashboard/navigation.ts` -- ADMIN_PAGES gains `{ id: "roles", href: "/roles", label: "Roles", icon: <existing icon from icons.tsx> }` (story 2.1's AdminNavigation filter gates it via `pageViewPermission("roles")` → `roles.view` automatically; nothing else changes).
- `src/app/(workspace)/roles/page.tsx` -- NEW RSC (~60 LOC). `getSessionUser()`; `hasPermission(user.permissions, "roles.view")` false → render `PagePermissionGate permission="roles.view"` with no children (or ForbiddenView directly) and **return before any query**; else `await searchParams`, `query()` the roles × users aggregate (same SQL shape as `src/lib/roles.ts` consumers / 1.3's GET), map via `toRoleResponse(row, count)`, render `<PagePermissionGate permission="roles.view"><RolesView initialRoles={...} initialRoleKey={searchParams.role} /></PagePermissionGate>`.
- `src/components/dashboard/roles-view.tsx` -- NEW client island (~400 LOC). Table + create/edit drawer (name, description, grouped permission toggles off `PERMISSION_GROUPS`/`PERMISSION_LABELS`), working-set state = raw grants; wildcard banner + Customize; duplicate prefill; delete block states; `apiFetch` mutations + toast (sonner) + refetch via `GET /api/roles`; `initialRoleKey` opens the drawer. Reuses `src/lib/roles.ts`'s `RoleResponse` type (type-only import is fine client-side).
- `src/components/dashboard/users-view.tsx` -- delete `ROLE_OPTIONS`; add a roles fetch (`GET /api/roles` → `{key,name}[]`, 403/error → distinct `user.role` from loaded users) feeding BOTH the AddUserDialog Select (label name, value key, default `Member`) and the FilterMenu options; FilterMenu's hardcoded `["Admin","Editor","Member"]` deleted.
- Untouched: `src/lib/**`, `src/app/api/**`, `src/proxy.ts`, auth pages, all other components.

## Tasks & Acceptance

**Execution:**
- [ ] navigation.ts roles entry.
- [ ] roles/page.tsx RSC with the server-side gate-before-query.
- [ ] roles-view.tsx island (table, drawer, toggles, wildcard, duplicate, delete states, refetch).
- [ ] users-view.tsx role-source switch (dialog + filter, fallback).

**Acceptance Criteria:**
- Given an Admin, when opening /roles, then every role lists with key/name/description/userCount/system badge/permission count, and `/roles?role=support` opens support's drawer.
- Given a Member (no roles.view), when deep-linking /roles, then the in-app 403 renders and the server never runs the roles query (no role data reaches the flight payload).
- Given the create drawer with toggled grants, when saving, then the role appears (userCount 0), a `role_audit` `role.created` row exists, and a duplicate-name create yields the suffixed key.
- Given the edit drawer, when renaming, then the name sticks under the same key with an audit `role.updated` row; when replacing grants, then the resolved state updates with an audit `role.permissions.replaced` row.
- Given the Admin role's drawer, then "All permissions (wildcard)" shows and Customize expands to the concrete set; saving replaces the wildcard (audit row with before `["*"]`).
- Given delete actions, then system roles show the cannot-delete state (no request), in-use roles show count + reassign guidance, and a free role deletes with an audit `role.deleted` row.
- Given the users page, then AddUserDialog and the role filter offer the API's roles (a custom role like `support` appears); with an Editor (no roles.view) the dialog still offers the directory's distinct roles.
- Given `npx vitest run`/`npm run build`/eslint on touched files, then 29/29 / exit 0 / clean.

## Implementation Notes

- The island's toggle working set: represent as `Set<string>` of raw grants; a fully-checked group with an available `resource.*` wildcard may still be stored as the concrete keys (simplest); the wildcard banner only appears when the SAVED grants contain `*`.
- Own-role guard UX: an Admin opening the Admin role's drawer sees the permissions area read-only (the API 403s own-role replaces) — render a note instead of editable toggles when `role.key === user.role` (user from `usePermission()`).
- `initialRoleKey` that matches no role → ignore silently.
- Icons: pick an existing icon from `src/components/icons.tsx` (e.g. Shield/Key-like) — do not add an icon dependency.

## Plan Change Log

- **Deviation (forced, type-level only):** the plan said "Untouched: `src/lib/**`", but the `navigation.ts` `roles` entry made `Record<NavPageId, …>` in `src/lib/permissions.ts` unsatisfiable (TS2741 — `roles` became both a nav id and an extra resource with two verbs declarations). Fix: `EXTRA_RESOURCES` hoisted above `VERBS_BY_PAGE` as `as const satisfies ReadonlyArray<{resource, verbs}>`, `VerbsPageId = Exclude<NavPageId, extra resources>`, `VERBS_BY_PAGE: Record<VerbsPageId, readonly Verb[]>` — `roles` now has exactly ONE verbs declaration. Runtime unchanged (catalog tests 29/29 prove it); the reviewer empirically confirmed the missing-verbs compile guard still fires when a page id is dropped. Net +16/−7 in permissions.ts.

## Review Triage Log

**Review: quick (pinned) — 1 medium, 1 low; both triaged.**

- **[medium → fixed in 2.2]** The RSC page's permission gate rendered the 403 view but the plan's flight-payload requirement ("no role data reaches a forbidden user") needed the gate to run BEFORE the roles query. Verified fixed in the implementation: `roles/page.tsx:48-56` returns `ForbiddenView` before `listRoles()` is ever called — confirmed empirically by curling the member HTML and finding zero role rows in the flight payload.
- **[low → fixed via patch]** `saveDetails` never resynced local state from the PATCH response (unlike sibling `saveGrants`) — a trailing-space edit left `detailsDirty` stuck true and a repeat click fired a semantically no-op PATCH, writing a duplicate `role.updated` audit row (the API audits every successful UPDATE without diffing). Patch: resync `name`/`description` from `data.role` on success (roles-view.tsx:489-495); the not-dirty state disables Save, killing both paths. Patch verified: vitest 29/29, build exit 0, eslint clean.
- **[deferred → 2.3]** Dead grants (a grant whose `resource.verb` matches no catalog verb) render nowhere in the drawer's working set — invisible and unremovable in the UI. 2.3's revised ticket now owns "dead grants as removable chips".
- **[deferred → 2.3]** `/roles` missing from `PROTECTED_PREFIXES` in `src/proxy.ts` — anonymous visitors got the client-side redirect instead of the sibling pages' middleware login redirect with `?next=`. 2.3 adds both `/roles` and `/permissions` there.
- **[rejected, no change]** A suggestion to debouce the roles refetch after mutations: the refetch happens once per completed mutation (user-paced), not per keystroke; complexity buys nothing at this call rate.

## Auto Run Result

**Status: built.** Implementation via subagent (route full), patch via SendMessage to the same implementer, verification by the main session.

- Files: `src/components/dashboard/navigation.ts` (+ roles admin entry), `src/app/(workspace)/roles/page.tsx` (NEW, 92 LOC RSC), `src/components/dashboard/roles-view.tsx` (NEW, client island), `src/components/dashboard/users-view.tsx` (role-source switch), `src/lib/permissions.ts` (forced deviation above).
- `npx vitest run`: **29/29 passed**. `npm run build`: **exit 0** (`/roles` ◐ Partial Prerender). `npx eslint` on all five touched files: **clean**.
- Manual (browser, 127.0.0.1:3011): Admin walk — list with userCount/badges/permission counts, create+audit row, rename (sticking), grant replace+audit, wildcard "All permissions (wildcard)"+Customize expansion, duplicate prefill, all three delete states, `?role=` drawer open; users-view role options from the API incl. custom role + Editor fallback; Member deep link → in-app 403 with no role rows in the flight payload (curl-verified); nav entry hidden for Member. Fixture drift restored after the pass.
- Riding along (not 2.2 code): user's same-day revision of `/permissions` into a per-role editor recorded in tickets.toml entry 3, the epic file, and the design doc addendum — committed together with this story.

## Design Notes

- Design §6 roles-page row: "RSC first paint + client island" — the 2.1 review carry-forward (flight payload) forces the gate before the query; the client gate stays as the second layer.
- The Editor fallback exists because epic 1's contract gates GET /api/roles on roles.view while users.create belongs to Editors too; the directory-distinct fallback is data-driven, never a hardcoded list.
- Cross-links: only `?role=` drawer-open lands here (both directions complete in 2.3, which owns the matrix side).

## Verification

**Commands:**
- `npx vitest run` -- expected: 29/29 unchanged.
- `npm run build` -- expected: exit 0.
- `npx eslint` on every touched file -- expected: clean.

**Manual checks (if no CLI):**
- Browser pass on 127.0.0.1:3011 per the I/O matrix (admin tracer-a / member tracer-b / editor-fix@onyx.dev password editor-password-1): full /roles walk (list, create+audit, rename, grant replace, wildcard Customize, duplicate, three delete states, ?role= drawer), Member 403 + flight-payload check (view page source / flight data contains no role rows), users-page role options incl. custom roles and the Editor fallback. Verify audit rows via node pg after the pass. Restore any mutated fixtures (support name, no-grants grants) after.

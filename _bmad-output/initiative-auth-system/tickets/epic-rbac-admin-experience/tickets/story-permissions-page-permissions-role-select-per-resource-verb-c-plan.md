---
title: 'Permissions page /permissions: role select + per-resource verb checkboxes'
type: 'feature'
ticket: '3'
created: '2026-11-03'
status: 'built'
baseline_revision: 'ab6ddab299a9c234870e5758ab71a6f45d467b96'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: ['oversized']
deferred: []
---

<intent-contract>

## Intent

**Problem:** Grants are only editable from inside the /roles drawer — there is no dedicated page where an admin picks a role and sees, at a glance, every resource's verbs as checkboxes (the user's revision, 2026-11-03); also /roles and /permissions are missing from the proxy's protected prefixes and dead grants are invisible/unremovable in the UI.

**Approach:** A `/permissions` page mirroring /roles' architecture (RSC gate-before-query + client island), but organized per role: a role selector reveals the editor — one row per `PERMISSION_GROUPS` resource with short verb-labeled checkboxes (`View | Create | …`) reflecting the role's resolved grants, a raw-grant-faithful working set (the toggle engine extracted from roles-view into a shared module), dead grants as removable chips, one Save = the audited full-set replace; wildcard `*` roles and the admin's own role render read-only; cross-links `?role=<key>` round-trip with /roles.

## Boundaries & Constraints

**Always:**
- RSC gate before query (2.2's flight-payload pattern): `getSessionUser()` + `roles.view` check returns `ForbiddenView` BEFORE the roles query runs; client `PagePermissionGate` stays as the second layer; whole body inside `Suspense` (cacheComponents).
- The working set is raw-grant-faithful (`Set<string>` of raw grants); checkboxes display `resolvePermissions([...working])` — exactly what the API would resolve. Stored `resource.*` wildcards stay stored unless a verb is turned OFF, which narrows to the group's other concrete keys (reuse `toggleVerbInSet`/`toggleGroupInSet` verbatim — do not re-derive).
- Save issues `PATCH /api/roles/[key]/permissions` with the FULL raw working set (dead-grant chips already removed from it); on success resync the working set from the response's `role.permissions` (the 2.2 patch's lesson — never keep typed state), toast, refetch `GET /api/roles`.
- Read-only states render the checkboxes disabled: raw grants containing `*` → lock note "grants every permission via the \* wildcard" + link to `/roles?role=<key>` (Customize lives in that drawer); `role.key === user.role` → own-role note (the API 403s own-role writes anyway). A role can be both (Admin editing Admin): show the own-role note first.
- Surface the API's error bodies: 400 `invalidPermissions`, 403 own-role, 404 deleted-elsewhere (deselect + refetch), 409 lockout guidance.
- The toggle-engine extraction is a pure move: `permission-toggles.tsx` gets the four symbols verbatim (plus an optional short-verb label option for this page), roles-view.tsx imports them back — behavior of /roles unchanged.

**Never:**
- No changes to the roles API, guards, audit semantics, seeds, or `resolvePermissions`/`isValidGrant` (epic 1 frozen; the `permissions.ts` edit is type-level only — see Code Map).
- No new permission keys: the `permissions` nav id owns NO verbs of its own (`pageViewPermission("permissions")` already overrides to `roles.view`); it must not appear in `PERMISSION_GROUPS`/`ALL_PERMISSION_KEYS`.
- No hardcoded role lists, no client-side wildcard *writing* (toggles only narrow stored wildcards as the engine defines), no changes to auth pages or any other view.
- No new vitest files for the client components (repo rule: no component test infra; the catalog suite pins the runtime invariants).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Admin opens | /permissions as Admin | Role selector lists every role (name + userCount hint); no editor until a role is picked | — |
| ?role= preselect | /permissions?role=support | support selected on load, editor open | unknown key → selector at placeholder, no editor |
| Edit custom role | pick `support` (concrete grants) | Rows Home/Ask AI/Agent Board/Watching/Users/Roles, verbs as short-labeled checkboxes checked per resolved grants; group checkbox with indeterminate | — |
| Toggle + Save | uncheck `users.update`, Save | dirty → Save enabled; PATCH full raw set → 200, one `role.permissions.replaced` audit row; working set resyncs from response; refetch keeps checks | 409 lockout → render guidance, keep editor dirty |
| Toggle off under wildcard | role holding `users.*`, uncheck `users.delete` | `users.*` narrows to the other concrete users keys in the working set (engine's rule) | — |
| Wildcard `*` role | pick Admin (`["*"]`) | Checkboxes disabled, all checked, lock note + "Customize" link → /roles?role=admin; no Save | — |
| Own role | admin picks their own role | Own-role note, checkboxes disabled, no Save | a Save must never fire (API 403s) |
| Dead grant | role holding `legacy.thing` (isValidGrant false) | Chip "legacy.thing" with remove ×; removing marks dirty; Save cleans it (next load shows no chip) | — |
| Role deleted elsewhere | Save returns 404 | Toast + deselect + refetch | — |
| Member deep link | /permissions without roles.view | Server: in-app 403 BEFORE query, no role rows in flight payload; nav entry hidden | — |
| Anonymous | /roles or /permissions with no cookies | Proxy redirects to /login?next=<path> | — |
| Editor link round-trip | /roles drawer → "Edit in permissions" | Opens /permissions?role=<key> with that role selected; selected-role header links back to /roles?role=<key> | — |

</intent-contract>

## Code Map

- `src/lib/permissions.ts` -- TYPE-LEVEL ONLY (planned this time; 2.2 hit this as a forced deviation): the `permissions` nav id joins `NavPageId` and breaks `Record<VerbsPageId, …>` — add an `ALIASED_PAGES = ["permissions"] as const satisfies readonly NavPageId[]` (pages that render another resource's permissions and own no verbs) and extend `VerbsPageId`'s `Exclude` with its members. Runtime exports (`PERMISSION_GROUPS`, `ALL_PERMISSION_KEYS`, `resolvePermissions`, `isValidGrant`, `pageViewPermission`) unchanged — the catalog suite pins them.
- `src/components/dashboard/permission-toggles.tsx` -- NEW shared module: MOVE `PermissionGroupToggles` (line 310), `PermissionToggles` (364), `toggleVerbInSet` (400), `toggleGroupInSet` (424) here verbatim from roles-view.tsx, exporting all four. One addition: `PermissionGroupToggles`/`PermissionToggles` accept optional `verbLabel?: (verb: Verb) => string` (default: current `PERMISSION_LABELS[key] ?? key` behavior, so /roles renders identically); /permissions passes short labels (view→"View", create→"Create", update→"Update", delete→"Delete", use→"Use", manage→"Manage"). Keep `"use client"` + the Checkbox/PERMISSION_LABELS imports it needs.
- `src/components/dashboard/roles-view.tsx` -- delete the four moved symbols, import from the new module (no behavior change); in `RoleEditSheet`'s permissions tab header add the "Edit in permissions" cross-link (`/permissions?role=${role.key}`) — small, secondary-styled link.
- `src/components/dashboard/permissions-view.tsx` -- NEW client island (~280 LOC): props `initialRoles: RoleResponse[]`, `initialRoleKey?: string`. Role selector (ui/select) → editor (`PermissionToggles` + dead-grant chips + Save/Reset bar). `usePermission()` for the own-role check. `apiFetch`/toast(sonner) as in roles-view. State: roles, selectedKey, working Set<string>, saving/dirty derived.
- `src/app/(workspace)/permissions/page.tsx` -- NEW RSC (~90 LOC): clone of roles/page.tsx's structure (gate-before-query, `listRoles()` aggregate — same SQL, `Suspense` wrapper, `firstParam` helper) passing `initialRoles` + `initialRoleKey` into `PermissionsView`.
- `src/components/dashboard/navigation.ts` -- `ADMIN_PAGES` += `{ id: "permissions", href: "/permissions", label: "Permissions", icon: SlidersHorizontal }` (icons.tsx exports it; `pageViewPermission("permissions")` → `roles.view` gates it — no other change).
- `src/proxy.ts` -- `PROTECTED_PREFIXES` += `"/roles"`, `"/permissions"`.
- Reuse as-is: `RoleResponse` from `src/lib/roles.ts` (`permissions` = raw, `resolvedPermissions` = expanded, `userCount?` on list), `resolvePermissions`/`isValidGrant` from permissions.ts (client-safe), `PagePermissionGate`, `ForbiddenView`, `usePermission`, `apiFetch`, `Badge`, `Button`, `Checkbox` via the toggles module.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/permissions.ts` -- add `ALIASED_PAGES`, extend `VerbsPageId` Exclude — keeps the compile guard honest without minting `permissions.*` keys.
- [ ] `src/components/dashboard/permission-toggles.tsx` -- extract the four toggle symbols + optional `verbLabel`.
- [ ] `src/components/dashboard/roles-view.tsx` -- import the moved symbols; add the Edit-in-permissions drawer link.
- [ ] `src/components/dashboard/permissions-view.tsx` -- the island: selector, editor, chips, save/reset, read-only states, error bodies.
- [ ] `src/app/(workspace)/permissions/page.tsx` -- RSC gate-before-query + Suspense + `?role=` param.
- [ ] `src/components/dashboard/navigation.ts` + `src/proxy.ts` -- the permissions nav entry; both prefixes protected.

**Acceptance Criteria:**
- Given an Admin on /permissions, when picking a custom role, then every catalog resource renders one row with its verbs as checkboxes matching that role's resolved grants, and `?role=<key>` preselects on load.
- Given toggles followed by Save, then exactly one `role.permissions.replaced` audit row is written, the working set resyncs from the response, and the checks survive the refetch.
- Given a `*`-holding or own role selected, then the editor is read-only (lock note linking /roles?role=, or own-role note) and no PATCH can fire.
- Given a dead grant in a role's raw set, then it renders as a removable chip and saving removes it from the stored grants.
- Given /roles' drawer link and the selected-role header link, then /permissions?role=<key> ↔ /roles?role=<key> round-trips both directions.
- Given an anonymous request to /roles or /permissions, then the proxy redirects to /login?next=<path>.
- Given a Member (no roles.view) deep link, then the in-app 403 renders with no role rows in the flight payload and the nav entry is hidden.

## Implementation Notes

## Plan Change Log

- 2026-11-03 (implementation): `src/lib/permissions.test.ts` — the "has a verbs entry for every nav page id plus watching" catalog test iterated ALL_PAGES at runtime and required every id to be a PERMISSION_GROUPS resource, so the planned `ADMIN_PAGES += permissions` entry failed it (28/29). The plan's "vitest 29/29" and its nav-entry task were in direct conflict; ALIASED_PAGES being type-level does not reach a runtime loop. Updated that one test to the plan's own aliased-pages rule — a nav id must either own a verbs entry containing `view` or be aliased via `pageViewPermission(id) !== \`${id}.view\`` — and additionally asserted the actual gate key is a real ALL_PERMISSION_KEYS member. All 29 tests pass; no runtime export of permissions.ts changed; the "No new vitest files" rule is respected (edited the existing suite, invariant preserved and tightened).

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` Dead-grant chip note contradicted the API: "saving keeps anything left" while PATCH /api/roles/[key]/permissions 400-rejects the whole submission while any !isValidGrant entry remains (verified against the route's write-time validation and the implementer's observed 400) — patched: note now reads "Remove them before saving: while one is left in the set, the API rejects the whole save" (moved into the shared DeadGrantChips component).
  - `[low]` `[patch]` No roles.manage read-only state: a roles.view-without-manage session (custom auditor role, creatable via this UI) got enabled toggles and a Save whose PATCH always 403s "Forbidden", while sibling /roles renders the same case read-only with an explanatory note — patched: canManage derived from usePermission(), !canManage renders /roles' exact note (PERMISSION_LABELS["roles.manage"]) with disabled toggles/chip-remove and no Save/Reset; own-role and wildcard notes keep display precedence with the manage note alongside. Live-verified with a temp-auditor role (tracer-b): note + all-disabled + no save; own-role+manage combination shows both notes; fixtures restored after.

## Auto Run Result

**Status: built.** Implementation via subagent (route full), 2 review patches via SendMessage to the same implementer, verification by the main session.

- Files: `src/app/(workspace)/permissions/page.tsx` (NEW, 96 LOC RSC — gate-before-query, Suspense, `?role=` preselect), `src/components/dashboard/permissions-view.tsx` (NEW, 462 LOC island), `src/components/dashboard/permission-toggles.tsx` (NEW — the toggle engine moved verbatim from roles-view + optional `verbLabel`), `src/components/dashboard/roles-view.tsx` (imports the moved symbols + "Edit in permissions" link), `src/lib/permissions.ts` (type-level `ALIASED_PAGES`), `src/lib/permissions.test.ts` (forced deviation below), `src/components/dashboard/navigation.ts` (permissions entry), `src/proxy.ts` (both admin prefixes protected).
- `npx vitest run`: **29/29**. `npm run build`: **exit 0** (`/permissions` ◐ Partial Prerender). `npx eslint` on all touched files: **clean**. `npx tsc --noEmit`: clean (implementer).
- Manual (main session, 127.0.0.1:3011): anonymous `/roles`+`/permissions` → 307 `/login?next=`; Admin walk — selector with name·count hints, `?role=support` preselect, checks exactly matching resolved grants (Watching 1/1, Users 1/4 mixed), toggle→Save wrote exactly ONE `role.permissions.replaced` audit row (node pg diff before/after), resync + dirty-cleared + checks survive refetch; `*` role → lock note + Customize→/roles?role= + all-checked-all-disabled + no Save (17/17 `aria-disabled`); own role → own-role note wins precedence; cross-links round-trip both directions (`Open in roles` ↔ `Edit in permissions`); Member deep link → in-app 403 with zero role rows in the payload and no admin nav. Post-patch: temp-auditor (roles.view only, with a seeded dead grant) → `/roles`-style manage note, everything disabled, no Save/Reset. Fixture drift restored (support grants, tracer-b role, temp role deleted via API).
- Review findings breakdown: 2 low findings, both patched (triage log above); 0 deferred; 0 rejected. Patched counts by verdict: low 2 → follow-up review not recommended (first pass; no high, fewer than 2 mediums).
- Residual risks: (a) 409 lockout branch not UI-exercised (shares the verified setError path; semantics pinned by epic 1); (b) read-only own-role/wildcard branches render no informative dead-grant chips (only the !canManage branch does) — cosmetic corner for 2.4's sweep; (c) `invalidMessage` doubles the API's "Unknown permission" prefix ("Unknown permission Unknown permission: x") — pre-existing in roles-view (2.2), copied verbatim; 2.4 candidate; (d) with an expired access token + valid refresh cookie the RSC renders 403 until re-navigation — pre-existing on all gated pages, not introduced here.
- Verification-account note: tracer-a@onyx.dev / tracer-b@onyx.dev (my fixture accounts) now use password `tracer-pass-1` (bcrypt reset during this pass; the pre-reset hashes were not recoverable).

## Design Notes

- Why a shared toggle module instead of cross-importing between islands: both pages edit the same raw-grant semantics; the engine is presentational + pure functions, so one module keeps `resource.*` narrowing defined exactly once (2.4's anticipated "shared helpers" cleanup stays for fetch/toast layers).
- The I/O matrix's "Toggle off under wildcard" row is the engine's documented rule — turning a verb ON under `resource.*` is a no-op (already implied), turning one OFF rewrites the wildcard as the group's other concrete keys.
- Dead-grant detection is `!isValidGrant(entry)` over the RAW working set (resolver-dropped ≠ stored); chips live outside the catalog rows because they have no row to sit in.
- Editor-appears-on-selection (no default role) keeps the first paint honest: nothing pretends to be selected before the admin chooses.

## Verification

**Commands:**
- `npx vitest run` -- expected: 29/29 (catalog runtime untouched; ALIASED_PAGES is type-level).
- `npm run build` -- expected: exit 0; `/permissions` Partial Prerender like `/roles`.
- `npx eslint` on every touched file -- expected: clean.

**Manual checks (if no CLI):**
- Browser pass on 127.0.0.1:3011 (dev server; re-login — access tokens are short-lived): Admin walk per the I/O matrix — selector, ?role= preselect, custom-role checks vs grants, toggle+Save (verify the single `role.permissions.replaced` audit row via node pg against `.env.local`'s DATABASE_URL; psql is not installed), wildcard lock, own-role note, dead-grant chip cleanup (seed one via SQL on a scratch role, then clean it through the UI), both cross-links, anonymous curl of /roles and /permissions → 302 /login?next=, Member 403 + hidden nav. Restore any fixture drift after.

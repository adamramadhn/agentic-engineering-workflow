---
title: 'Client gating: PermissionProvider, usePermission, filtered nav, in-app 403'
type: 'feature'
ticket: '1'
created: '2026-11-03'
status: 'built'
baseline_revision: '8707d65ed866911372ef2ffa46fbc5075ab83951'
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

**Problem:** The API enforces permissions (epic 1), but the UI ignores them entirely — every signed-in user sees every menu entry (Users, Watching, Ask AI) and every page mounts its view regardless of grants, relying on the API's 403 instead of an in-app experience.

**Approach:** The client half of RBAC (design §6, §10 step 5): `PermissionProvider` fetches `GET /api/auth/me` once on mount (and again on window focus — the Should item that makes revokes feel instant), `usePermission()` exposes `{ user, permissions, can, status }`, and every navigation surface filters by `can(<id>.view)` — sidebar (mobile nav, desktop nav, `AdminNavigation`, the whole Watching section), command palette (nav, admin, watched-companies groups), and the shell header's Ask AI link. A `PagePermissionGate` wraps each page view (home, users, ask-ai, agent-board, watching) rendering a new in-app `ForbiddenView` (403 tag, ask-admin copy naming the permission's label) when denied — dashboard chrome stays, the gated view never mounts. Ask AI's send action checks `ask-ai.use`.

## Boundaries & Constraints

**Always:**
- `can()` is plain Set membership over the resolved array from `me` — no wildcard interpretation client-side (the payload is already expanded by epic 1).
- While `status === "loading"`, `PagePermissionGate` renders a lightweight centered placeholder and NOT its children — a forbidden view must never mount (and never fire its API call), in either direction; nav surfaces filter against the empty set while loading (hidden is the safe direction).
- `ForbiddenView` mirrors `not-found-view.tsx`'s structure and styling (403 mono tag, title "You don't have access to this page", ask-admin copy naming the permission label from `PERMISSION_LABELS`, Dashboard link home) — it renders inside the page body, not a full-screen `StatusShell` page.
- The API stays the enforcement point (epic 1, unchanged): client gating is UX, never the barrier.
- Re-fetch `me` on window focus, replacing permissions/user state (same session, no re-login).

**Never:**
- No new nav entries (`roles`/`permissions` entries land with their pages in stories 2.2/2.3); no changes to `navigation.ts`'s page lists, the auth pages, `src/proxy.ts`, API routes or contracts, the catalog, or the seed.
- No component-test infrastructure (epic 3's scope); no UI redesign of the sidebar/palette beyond the filtering behavior; no persisted client permission cache (localStorage etc.).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Member sidebar | Member (no `users.view`) | No Users entry anywhere (mobile, desktop, collapsed); Home/Ask AI/Agent Board/Watching present | — |
| Member palette | ⌘K as Member | Navigation + Watching + companies; Admin group absent (or empty-hidden) | — |
| Member deep link | navigate to /users | In-app 403 view inside dashboard chrome; UsersView never mounts, no `/api/users` call | — |
| Admin | Admin (`*`) | Every entry renders; every page loads | — |
| no-grants fixture | role with `[]` grants | No workspace entries, no Admin, no Watching section, no header Ask AI link; every deep link 403s | — |
| Loading | first paint before `me` resolves | Gates show placeholder; nav filters against empty set (hidden) | — |
| me 401 | session expired mid-session | `user` null, permissions empty, everything gated/hidden (middleware normally redirects first) | defensive only |
| Focus re-fetch | admin revokes a grant server-side | user focuses the window → `me` re-fetches → UI reflects the new permissions with no re-login | transient failures leave prior state |
| Ask AI send | role without `ask-ai.use` (but with `ask-ai.view`) | page renders; send action disabled with a hint | — |
| Watching hidden | no `watching.view` | Whole Watching section (companies + Show all) absent in sidebar and palette | — |

</intent-contract>

## Code Map

- `src/components/dashboard/permission-provider.tsx` -- NEW (~90 LOC, "use client"). Context + `usePermission()` hook per design §6: fetch `/api/auth/me` on mount (reuse the `apiFetch` helper `user-profile-menu.tsx` uses), `window` focus listener re-fetching, state `{ user: SessionUser | null, permissions: ReadonlySet<string>, status: "loading" | "ready" }`; `can(permission)` = `permissions.has(permission)`. 401 → `{ user: null, permissions: empty, status: "ready" }`. Provider value memoized; hook throws outside provider.
- `src/components/dashboard/page-permission-gate.tsx` -- NEW (~25 LOC, "use client"). `<PagePermissionGate permission="users.view">{children}</PagePermissionGate>` — loading → centered minimal placeholder; ready + can → children; ready + !can → `<ForbiddenView permission={...} />`.
- `src/components/status/forbidden-view.tsx` -- NEW (~45 LOC, "use client"). Mirrors `not-found-view.tsx`: `403` mono tag, "You don't have access to this page" title, copy "Ask an administrator to grant you the `<PERMISSION_LABELS[permission]>` permission", and a single Dashboard link back home (no secondary link).
- `src/components/dashboard/dashboard-shell.tsx` -- wrap `AppSidebar`/`DashboardContent`/`CommandPalette` in `<PermissionProvider>`; header Ask AI link renders only under `can("ask-ai.view")`.
- `src/components/dashboard/app-sidebar.tsx` -- filter `navItems` by `can(`${id}.view`)` (mobile + desktop maps); `AdminNavigation` filters `ADMIN_PAGES` the same way and hides the whole section (label included) when empty; both Watching blocks (mobile + desktop) render only under `can("watching.view")`.
- `src/components/dashboard/command-palette.tsx` -- filter Navigation group by `can(`${id}.view`)`, Watching item + Watched Companies group under `can("watching.view")`, Admin group by `can(`${id}.view")` hidden when empty.
- `src/app/(workspace)/*/page.tsx` ×5 -- wrap each view: home→`home.view`, users→`users.view`, ask-ai→`ask-ai.view`, agent-board→`agent-board.view`, watching→`watching.view` (watching's inline RSC content passes through as children).
- `src/components/dashboard/ask-ai-view.tsx` -- the send action disables under `!can("ask-ai.use")` with a short hint; no other changes.

## Tasks & Acceptance

**Execution:**
- [ ] permission-provider.tsx (context, me fetch, focus re-fetch, can()).
- [ ] forbidden-view.tsx + page-permission-gate.tsx.
- [ ] dashboard-shell: provider mount + Ask AI header gating.
- [ ] app-sidebar: 6 filtering points.
- [ ] command-palette: 3 filtering points.
- [ ] 5 page wraps + ask-ai send gating.

**Acceptance Criteria:**
- Given a signed-in Member, when the dashboard renders, then the sidebar (expanded, collapsed, mobile) and command palette show no Users entry while Home/Ask AI/Agent Board/Watching all render.
- Given a Member deep-linking to /users, then the in-app 403 view renders inside the dashboard chrome (breadcrumb/header intact) and the network shows no `/api/users` request.
- Given the `no-grants` fixture role, when signing in, then no workspace/Admin/Watching entries render anywhere and every page deep link shows the 403 view.
- Given an Admin, when navigating, then every entry renders and every page loads as before this story.
- Given a role with `ask-ai.view` but not `ask-ai.use`, when on /ask-ai, then the page renders and the send action is disabled with a hint.
- Given an admin revokes `users.view` from the Member role via the API, when the Member's window regains focus, then the Users entry disappears and /users now 403s — no re-login.
- Given `npx vitest run`, then 29/29 still pass (no test changes); given `npm run build`, exit 0; given eslint on all touched files, clean.

## Implementation Notes

- `user-profile-menu.tsx` keeps its own `me` fetch for the account menu — not refactored onto the provider here (behavior-neutral cleanup only if trivial; otherwise epic 2's sweep story).
- SessionUser type import from `@/lib/auth` is type-only in the provider (client component must not pull server code — verify `@/lib/auth` is importable client-side as type-only; if it drags server deps, define a minimal local `PermissionedUser` shape instead).

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass (quick, pinned)
- verdicts: 5 findings — high 0, medium 1, low 3, rejected-as-not-a-defect 1; reviewer's clean list: every navigation surface covered, loading contract airtight (SSR renders placeholder, no view mounts pre-resolution, provider persists across soft navigations via layout), 401 path safe in every ordering, AdminNavigation's `pageViewPermission` deviation exactly equivalent today and design-sanctioned.
- findings:
  - `[medium]` `[patch]` permission-provider `load` had no request sequencing — a slow in-flight `me` fetch (e.g. riding apiFetch's 401→refresh→retry) resolving after a fresh focus re-fetch would overwrite narrower permissions, re-showing revoked entries and letting a gated view mount until the next focus — patched with a monotonic token (`latestLoadRef`): only the most recently started fetch may commit, `.then` bails and `.finally`'s setStatus is gated on freshness; verified by the implementer with a temporary vitest race test against the real module plus a mutation check (guards removed → test fails as the finding predicts; restored → green), test then deleted per the no-component-infra rule.
  - `[low]` `[patch]` `handleRegenerate` bypassed the `ask-ai.use` gate (Regenerate still worked after a revoke flipped `canUseAskAi` false) — patched: early return in `handleRegenerate`, `disabled` on the Regenerate button and the suggested-prompt chips, matching the send button's pattern.
  - `[low]` `[defer→2.4]` initial-load transport failure renders as an authoritative 403 with misleading copy ("ask an administrator…") and no retry — deny-all direction is safe and plan-sanctioned; distinguishing "denied" from "unknown" (placeholder + retry on first-load catch) is sweep-story polish.
  - `[low]` `[reject]` ForbiddenView's Dashboard CTA dead-ends into another 403 for a user without `home.view` — matches design §6 verbatim ("Dashboard link back home"); design note recorded: hide the CTA or fall back to sign-out when `can("home.view")` is false (adjacent pre-existing case: not-found-view's unconditional Ask AI button — same class, sweep material).
  - `[rejected as not-a-defect here]` `[carry→2.2]` the watching page's RSC children serialize into the flight payload for forbidden users — zero confidentiality impact today (content is static `WATCHED_COMPANIES` constants already in the client bundle), but the same pattern on 2.2's planned "RSC first paint" `/roles` page would leak real DB role data in the flight payload: **2.2 must check `roles.view` server-side in the RSC (gate before the query), not rely on the client PagePermissionGate.**

## Design Notes

- Design §6: provider mounted in DashboardShell wrapping all three gated surfaces; `can` is Set membership; no wildcard interpretation client-side.
- Hidden-and-blocked is the v1 default (no "hidden but reachable" flag — parked in the design).
- Focus re-fetch is the Should item that makes revokes near-instant; riding here per the epic's note that Should items live inside stories.

## Verification

**Commands:**
- `npx vitest run` -- expected: 29/29 unchanged.
- `npm run build` -- expected: exit 0.
- `npx eslint` on every touched file -- expected: clean.

**Manual checks (if no CLI):**

## Auto Run Result

**Status: built (first pass + 2 patches, 2026-11-03).**

- **Summary:** The client half of RBAC (design §6, §10 step 5). `PermissionProvider` (new) fetches `/api/auth/me` on mount and on window focus with a monotonic-token sequencing guard (only the newest fetch commits — patched after review), exposing `{ user, permissions: ReadonlySet, can, status }`; `usePermission()` drives every surface: sidebar (mobile + desktop nav maps filtered by `<id>.view`, `AdminNavigation` filtered by `pageViewPermission` + hidden when empty, both Watching blocks under `watching.view`), command palette (nav/admin/watched-companies groups), the shell header's Ask AI link, and `PagePermissionGate` (loading → placeholder with children never mounted; denied → new in-app `ForbiddenView` with the permission's label and a Dashboard link) wrapping all five page views; ask-ai's send/regenerate/chips gate on `ask-ai.use` with a hint.
- **Files changed:** 3 new (`permission-provider.tsx`, `page-permission-gate.tsx`, `status/forbidden-view.tsx`), 9 modified (`dashboard-shell`, `app-sidebar`, `command-palette`, 5 page files, `ask-ai-view`), this plan. +409/−46 code.
- **Review findings:** Quick lens, 5 findings: medium 1 + low 1 → patched (fetch-sequencing race with a mutation-checked temporary race test; regenerate gate bypass); low 1 → deferred to 2.4 (transport-failure copy); low 1 → rejected (design-verbatim CTA, design note recorded); 1 → not a defect here but carried into 2.2's requirements (RSC flight-payload: server-side `roles.view` check required). Patched counts by verdict: medium 1, low 1.
- **Follow-up review recommended: false** — one medium + one low patched; the rule requires a high or two mediums.
- **Verification performed:** `npx vitest run` 29/29 (unchanged); `npm run build` exit 0 (18 routes, type-checks the type-only `SessionUser` import); eslint clean on all 12 touched files; headless-browser pass (Playwright 1.64.1, dev 127.0.0.1:3011) — 45/45 checks: Member (no Users entry in sidebar/palette, all four other surfaces present, `/users` deep link renders the in-app 403 with the "View users" label and **zero** `/api/users` requests, focus triggers a fresh `me`), Admin (everything renders, directory loads), empty-grants user (no entries anywhere, header Ask AI hidden, all five deep links 403, palette shows only Actions), view-only ask-ai fixture (page renders, send/regenerate/chips disabled with hint); loading placeholder verified by code-reading (SSR initial state deny-all → placeholder); patch re-verified by vitest/build/eslint + the implementer's race test (deleted after, per the no-component-infra rule).
- **Residual risks:** none blocking. Fixture note: the dev DB's `no-grants` role drifted to `["users.view"]` during epic-1 testing — the empty-permissions pass used the `empty-grants` role instead; both roles remain available fixtures. Deferred polish rides 2.4 (failure-vs-denied copy, 403 CTA fallback, not-found-view's unconditional Ask AI link).
- Browser pass on 127.0.0.1:3011 per the I/O matrix: Member (tracer-b@onyx.dev / tracer-password-1) sidebar + palette + /users deep link (no /api/users call in the network log); Admin (tracer-a@onyx.dev / tracer-password-1) full surface; no-grants fixture sign-in for the empty-permissions pass; focus re-fetch check (revoke users.view as admin, focus the Member tab, Users disappears); ask-ai send-disabled check with a view-only fixture. Fixtures exist: `no-grants` role with a user — attach one via `POST /api/users` (role `no-grants`) if no user holds it yet, and clean up after.

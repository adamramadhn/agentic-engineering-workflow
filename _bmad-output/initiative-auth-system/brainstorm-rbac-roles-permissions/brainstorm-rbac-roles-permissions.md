# RBAC — Roles & Permissions Design (build-ready)

Status: design complete, decisions final. Source: brainstorm memlog (`.memlog.md`, same directory). Alternatives and their rejection reasons live there; this document only states what to build.

---

## 1. Overview & chosen architecture

**One `resource.action` permission key from one code catalog drives the sidebar filter, the page 403, and the API guard; the database stores only who-has-what (role → grants), and the API layer is the only place that can say yes.**

Consequences that shape everything below:

- **Hybrid catalog.** The set of valid permissions is defined in code (`src/lib/permissions.ts`), derived from `navigation.ts` page ids × a per-page verb list, plus two admin resources (`roles.view`, `roles.manage`). Adding an app page = adding one catalog entry. **No migration.**
- **DB stores grants only.** `roles.permissions` is a JSONB array of granted keys (wildcards allowed). Nothing else about permissions is in the database.
- **Enforcement layering.** `src/proxy.ts` stays **auth-only** (edge-safe, `jose` only, never `pg`) — unchanged. The real gate is `requirePermission()` at the top of every API route handler. Client-side hiding (sidebar, buttons) is cosmetics for UX, never security.
- **Classic NIST-style RBAC**, plain SQL + one helper. No Casbin/CASL/permit.io, zero new runtime dependencies.
- **Safety rails are part of the feature**: no editing your own role's permissions, no deleting a role with attached users, no stripping `roles.manage` from the last holder, audit row on every mutation.

### Verified codebase facts this design depends on

| Fact | Where | Implication |
|---|---|---|
| `WORKSPACE_PAGES` = `home, ask-ai, agent-board`; `ADMIN_PAGES` = `users`; `ALL_PAGES` is the sidebar source; `watching` is a special `WorkspaceRoute` **not** in `ALL_PAGES` | `src/components/dashboard/navigation.ts` | Catalog resources = nav ids + explicit `watching` + `roles`. Sidebar filter iterates `ALL_PAGES`. |
| `ensureSchema()` idempotent bootstrap, schema v2, `users.role TEXT NOT NULL DEFAULT 'Member'`, UUID PKs | `src/lib/db.ts` | Schema v3 rides the same pattern (same file, same promise cache). |
| Access JWT carries `{ sub, email, role, type }`, 15-min TTL; refresh rotates 7 days; `getSessionUser()` re-loads the user row from the DB strictly | `src/lib/jwt.ts`, `src/lib/auth.ts` | **No new JWT claims in v1.** Because `getSessionUser` already hits the DB, resolving permissions there makes server-side enforcement *immediate*, not TTL-bound. |
| `export const ROLES = ["Admin", "Editor", "Member"] as const` hardcoded; GET list + POST create only | `src/app/api/users/route.ts` | Delete `ROLES`; validate `role` against the `roles` table instead. |
| Register inserts role `"Admin"` (first user) / `"Member"`; users-view has its own `ROLE_OPTIONS = ["Admin","Editor","Member"]` (line 142) and a hardcoded role filter list | `src/app/api/auth/register/route.ts`, `src/components/dashboard/users-view.tsx` | Seeded role keys must be the **capitalized** `Admin`/`Editor`/`Member` so the FK lands with zero data migration; users-view role UI switches to `GET /api/roles`. |
| Route handler dynamic `params` is a **Promise** in this Next version | `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` | All `/api/roles/[key]` handlers: `{ params }: { params: Promise<{ key: string }> }` and `await params`. |

---

## 2. Permission catalog — `src/lib/permissions.ts`

New file. **Pure module: no `pg`, no `next/headers`, no server-only imports** — it is imported by client components (sidebar, matrix UI) as well as server code. DB access lives elsewhere (§4/§5).

### Key format

```
<resource>.<verb>
```

- `resource` = a `navigation.ts` page id (`home`, `ask-ai`, `agent-board`, `users`) or an explicit non-nav resource (`watching`, `roles`). Kebab-case.
- `verb` = lowercase action. v1 verbs: `view`, `create`, `update`, `delete`, `use`, `manage`. Arbitrary future verbs (`export`, `approve`) fit the same format with a catalog edit only.
- Row-scope suffixes (`users.view.own`) are deliberately **not** in v1 but the format tolerates them later without schema change.

### Catalog shape

```ts
// src/lib/permissions.ts
import { ALL_PAGES } from "@/components/dashboard/navigation";

export type Verb = "view" | "create" | "update" | "delete" | "use" | "manage";

/** Nav-page ids that require a verbs entry. `watching` is a WorkspaceRoute
 *  that is not part of ALL_PAGES, so it is added explicitly here. */
type NavPageId = (typeof ALL_PAGES)[number]["id"] | "watching";

/** Record<NavPageId, ...> makes TypeScript fail the build when a page is added
 *  to navigation.ts without a verbs entry — the single-source-of-truth check. */
const VERBS_BY_PAGE: Record<NavPageId, readonly Verb[]> = {
  home:         ["view"],
  "ask-ai":     ["view", "use"],
  "agent-board": ["view"],
  watching:     ["view"],
  users:        ["view", "create", "update", "delete"],
};

/** Non-page admin resources. */
const EXTRA_RESOURCES: ReadonlyArray<{ resource: string; verbs: readonly Verb[] }> = [
  { resource: "roles", verbs: ["view", "manage"] },
];

export interface ResourceGroup {
  resource: string;
  label: string;                 // group heading in matrix UI + i18n base
  verbs: readonly Verb[];
}

/** Ordered for UI display: workspace pages, then watching, then admin. */
export const PERMISSION_GROUPS: readonly ResourceGroup[] = [ /* derived from the two tables above */ ];

/** Every valid concrete key, e.g. ["home.view", "ask-ai.view", ..., "roles.manage"]. */
export const ALL_PERMISSION_KEYS: readonly string[] = [ /* groups × verbs */ ];

/** Stable keys → human labels. Keys never change; labels are the i18n surface
 *  (swap map values for translated strings later, keys stay forever). */
export const PERMISSION_LABELS: Record<string, string> = {
  "home.view": "View Home",
  "ask-ai.view": "View Ask AI",
  "ask-ai.use": "Use Ask AI",
  "agent-board.view": "View Agent Board",
  "watching.view": "View Watching",
  "users.view": "View users",
  "users.create": "Create users",
  "users.update": "Update users",
  "users.delete": "Delete users",
  "roles.view": "View roles & permissions",
  "roles.manage": "Manage roles & permissions",
};
```

The full v1 key set is exactly those 11 keys.

### View-permission mapping for nav entries

Both new admin pages (`/roles`, `/permissions`) are gated by the single `roles.view` key — the catalog has no `permissions.*` resource. One explicit override keeps "nav id → key" a function:

```ts
/** Sidebar/page gate for a nav page id. Default `${id}.view`; the matrix page
 *  shares the roles resource's view verb. */
export function pageViewPermission(pageId: string): string {
  return pageId === "permissions" ? "roles.view" : `${pageId}.view`;
}
```

### Wildcards and the resolver

A role's `permissions` JSONB may contain `"*"` (everything) or `"users.*"` (all verbs of one resource). Wildcards are expanded **at resolve time** so downstream checks are plain set membership — clients never interpret wildcards.

```ts
/** Expand wildcards against the catalog and drop unknown/dead grants.
 *  Returns a de-duplicated, catalog-ordered list of concrete keys.
 *  Invariant: the output NEVER contains "*" or "*.\\*" entries. */
export function resolvePermissions(granted: readonly string[]): string[]

/** Membership test against an already-resolved list. */
export function hasPermission(resolved: readonly string[], required: string): boolean
```

Resolver rules (unit-tested, §9):

1. `"*"` → all of `ALL_PERMISSION_KEYS`.
2. `"<resource>.*"` where `<resource>` is a known group → that group's keys; unknown resource → dropped.
3. A concrete key not in `ALL_PERMISSION_KEYS` → dropped (dead grants are inert; stale data can never grant a permission the code no longer defines).
4. Output is de-duplicated and in `PERMISSION_GROUPS` order — deterministic, snapshot-testable.

---

## 3. Schema v3 — `src/lib/db.ts`, inside `ensureSchema()`

Same idempotent pattern as v2: plain `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` statements appended after the existing block, still guarded by the single `schemaReady` promise (runs once per server process; the existing `.catch` reset that allows retry stays). Update the file's header comment from "schema v2" to "schema v3" and note the addition.

**Ordering matters**: `roles` must exist **and be seeded** before the FK is added, because existing `users.role` rows must all satisfy the constraint. All values ever writable through the app are exactly `Admin`, `Editor`, `Member` (db default `'Member'`, register's `"Admin"`/`"Member"`, users API's deleted `ROLES` const) — the seed covers them, so **no `UPDATE users` statement is needed**. Zero data migration.

```sql
-- 1. Roles
CREATE TABLE IF NOT EXISTS roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Audit trail (tiny, from day 1)
CREATE TABLE IF NOT EXISTS role_audit (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,  -- nullable: audit outlives actors
  action     TEXT NOT NULL,          -- 'role.created' | 'role.updated' | 'role.deleted' | 'role.permissions.replaced'
  role_key   TEXT NOT NULL,          -- raw key, not an FK: audit rows must survive role deletion
  diff       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_role_audit_role_key_created ON role_audit(role_key, created_at DESC);

-- 3. Seed the 3 system roles. Keys MUST be the capitalized literals so existing
--    users.role rows satisfy the FK below with zero migration.
--    ON CONFLICT DO NOTHING = seeded once; admin edits to system roles survive restarts.
INSERT INTO roles (key, name, description, permissions, is_system) VALUES
  ('Admin',  'Admin',  'Full access to every page and action',
    '["*"]'::jsonb, true),
  ('Editor', 'Editor', 'Workspace plus user management, no user deletion',
    '["home.view","ask-ai.view","ask-ai.use","agent-board.view","watching.view",
      "users.view","users.create","users.update"]'::jsonb, true),
  ('Member', 'Member', 'Workspace view access',
    '["home.view","ask-ai.view","ask-ai.use","agent-board.view","watching.view"]'::jsonb, true)
ON CONFLICT (key) DO NOTHING;

-- 4. users.role becomes a real FK. Postgres has no ADD CONSTRAINT IF NOT EXISTS,
--    so guard via pg_constraint in a DO block (idempotent across restarts).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_fkey'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_role_fkey
      FOREIGN KEY (role) REFERENCES roles(key);
  END IF;
END $$;
```

Idempotency requirements checklist:

- Every `CREATE` uses `IF NOT EXISTS`; the seed uses `ON CONFLICT (key) DO NOTHING`; the FK is wrapped in the `DO $$ ... $$` existence check. Running the block N times is a no-op after the first.
- `gen_random_uuid()` is already available (the existing `pgcrypto` best-effort attempt precedes it).
- System roles: `is_system = true` → undeletable, `key` immutable; `name`/`description`/`permissions` remain editable (customization is the requirement) subject to the lockout guards in §5.

---

## 4. Auth integration

### `SessionUser` grows `permissions`

`src/lib/auth.ts`:

- `loadUserByIdRow()` gains a `LEFT JOIN roles` and returns the raw grants:

```sql
SELECT u.id, u.name, u.email, u.password_hash, u.role, u.team, u.status, u.created_at,
       COALESCE(r.permissions, '[]'::jsonb) AS role_permissions
FROM users u LEFT JOIN roles r ON r.key = u.role
WHERE u.id = $1
```

`COALESCE` keeps a user whose role row is missing at `[]` = deny-all (cheap insurance; after v3 the FK makes it unreachable).

- `SessionUser` and `toSessionUser()` gain:

```ts
export interface SessionUser {
  id: string; name: string; email: string; role: string;
  team: string; status: string; createdAt: string;
  permissions: string[];   // resolved + expanded via resolvePermissions() — concrete keys only
}
```

`toSessionUser` calls `resolvePermissions(row.role_permissions)`. Every caller of `getSessionUser()`/`loadUserById()` gets permissions for free.

### `GET /api/auth/me`

Handler is unchanged — its `{ user }` payload now simply contains `permissions: string[]`. Additive, no shape break, no new endpoint (the sidebar derives from the existing `me` payload).

### Access JWT — no new claims in v1

The access token keeps `{ sub, email, role, type }`. Authorization never reads the token's `role` claim (it re-resolves from the DB), so permission changes **take effect at the API immediately** — the next guarded request already sees the new grants, because `getSessionUser()` joins `roles` fresh. The 15-min TTL only bounds client-side *display* staleness (a revoked menu item may linger until the next `me` re-fetch); that is accepted and documented v1 behavior. A `perm_version` claim with refresh-flow rejection is parked for v2.

---

## 5. API layer

### `requirePermission()` — `src/lib/permission-guard.ts` (server-only)

One line per route handler; imports `getSessionUser` + the pure `hasPermission`.

```ts
import { getSessionUser, type SessionUser } from "./auth";
import { hasPermission } from "./permissions";

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

export async function requirePermission(required: string): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, response: Response.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (!hasPermission(user.permissions, required)) {
    return { ok: false, response: Response.json(
      { error: "Forbidden", requiredPermission: required }, { status: 403 }) };
  }
  return { ok: true, user };
}
```

Usage pattern in every handler:

```ts
const guard = await requirePermission("users.view");
if (!guard.ok) return guard.response;
const user = guard.user;   // actor for audit writes
```

### Roles API surface

All under `src/app/api/roles/`. Next 16 dynamic-route signature (verified against `node_modules/next/dist/docs/.../route.md`): `{ params }: { params: Promise<{ key: string }> }`, then `const { key } = await params;`.

| Route | Guard | Behavior |
|---|---|---|
| `GET /api/roles` | `roles.view` | All roles + attached `userCount` (LEFT JOIN count). Returns raw `permissions` **and** `resolvedPermissions` (matrix + drawer render resolved state). |
| `POST /api/roles` | `roles.manage` | Body `{ name, description?, permissions?: string[] }`. Server derives the key: slugified unique `name` (append `-2`, `-3`… on collision). Every permission entry validated as a catalog key or wildcard, else `400`. `is_system` always `false`. Audit `role.created`. |
| `PATCH /api/roles/[key]` | `roles.manage` | Body `{ name?, description? }`. **`key` immutable** (URL is the only identity). System roles: name/description editable. `404` unknown key. Audit `role.updated` with `{ before, after }`. |
| `DELETE /api/roles/[key]` | `roles.manage` | `409` if `is_system` ("System roles cannot be deleted"). `409` with `{ error, userCount }` if attached users — message points to reassigning users first (no silent migration). Audit `role.deleted`. |
| `PATCH /api/roles/[key]/permissions` | `roles.manage` | Body `{ permissions: string[] }` — **full-set replace**, no row-level diff protocol. Validate every entry (catalog key or wildcard), else `400`. Lockout guards below. Audit `role.permissions.replaced` with `{ before, after }`. |

### Lockout guards (server-side, in the roles routes)

1. **No editing your own role's permissions.** `PATCH .../permissions` where `key === guard.user.role` → `403`. Kills self-escalation and self-lockout in one rule. (Editing your own role's *name* via `PATCH /[key]` stays allowed — harmless.)
2. **No deleting a role with attached users.** Count users by role first; `> 0` → `409` + count. This also transitively blocks deleting your own role (you are attached to it).
3. **No stripping `roles.manage` from the last holder.** Before accepting a replace that removes `roles.manage` (directly or by wildcard removal) from a role: compute the post-mutation set of roles whose grants resolve to `roles.manage`; if **zero users** would hold any of them → `409`. Guards 1+2 make this mostly unreachable today — it is deliberate defense-in-depth (a future admin API or SQL console must not be able to produce a lockout).

### Audit writes

Every successful mutation in the roles API appends one `role_audit` row: `actor_id = guard.user.id`, `action`, `role_key`, `diff` (`{ before, after }` for updates/replaces; `{ role, permissions }` snapshot for create; `{ name }` for delete). Written as a sequential `await query(...)` after the mutation; an audit-insert failure is logged and does not fail the mutation (audit is insurance, not a transactional participant).

### Applying guards to the existing users routes

`src/app/api/users/route.ts`:

- `GET` → `requirePermission("users.view")` (replaces the bare `getSessionUser()` 401 check).
- `POST` → `requirePermission("users.create")`.
- **Delete `export const ROLES`.** `POST` validates `body.role` against `SELECT key FROM roles` — unknown role → `400 "Unknown role"` (no silent fallback to Member).
- When `PATCH/DELETE /api/users/[id]` routes are added later they map to `users.update` / `users.delete`; the catalog already carries the verbs.
- `src/components/dashboard/users-view.tsx`: replace the hardcoded `ROLE_OPTIONS` (line 142) and the hardcoded role filter list (line 90) with keys/names fetched from `GET /api/roles` (cache in component state; the page already fetches `/api/users` on mount).

---

## 6. Frontend

### `PermissionProvider` + `usePermission()`

New `src/components/dashboard/permission-provider.tsx` (client):

- Fetches `GET /api/auth/me` once on mount; exposes `{ user, permissions: string[] , can(permission: string): boolean, status }`. `can` is `Set` membership over the resolved array (no wildcard interpretation client-side — the payload is already expanded).
- Mounted in `DashboardShell` (`src/components/dashboard/dashboard-shell.tsx`) wrapping `AppSidebar`, `DashboardContent`, and `CommandPalette` so all three can gate.
- Re-fetches `me` on window focus (SHOULD) — this is what makes permission changes feel near-instant in the UI.

```ts
export function usePermission(): {
  user: SessionUser | null;
  permissions: ReadonlySet<string>;
  can(permission: string): boolean;
}
```

### Sidebar filtering

In `app-sidebar.tsx` (and `command-palette.tsx`, same rule):

- `WORKSPACE_PAGES.filter(p => can(`${p.id}.view`))` for the main nav (desktop + mobile).
- `AdminNavigation` filters `ADMIN_PAGES` by `can(pageViewPermission(p.id))`; hide the whole "Admin" section when empty. `ADMIN_PAGES` gains `{ id: "roles", href: "/roles", label: "Roles", icon: ... }` and `{ id: "permissions", href: "/permissions", label: "Permissions", icon: ... }` in `navigation.ts`.
- The **entire Watching section** (company links + "Show all") renders only under `can("watching.view")`.
- `dashboard-shell.tsx` header "Ask AI" quick link gates on `can("ask-ai.view")`.
- No view permission = hidden **and** blocked (v1 default; a "hidden but reachable" flag is parked).

### Per-page client guard + 403 view

- New `src/components/status/forbidden-view.tsx` mirroring `not-found-view.tsx` structure: `403` tag, "You don't have access to this page" title, ask-admin copy ("Ask an administrator to grant you the `<permission label>` permission"), `Dashboard` link back home.
- New `PagePermissionGate` client component: renders children when `can(permission)`, else `<ForbiddenView />` inside the page body (dashboard chrome stays — this is an in-app 403, not a full-screen `StatusShell` page).
- Wrap each page view: `users` → `users.view`, `ask-ai` → `ask-ai.view` (+ message-send actions check `ask-ai.use`), `agent-board` → `agent-board.view`, `watching` → `watching.view`, `home` → `home.view`, `/roles` → `roles.view`, `/permissions` → `roles.view`. This is the deep-link experience; the API remains the enforcement point.

### Role master page — `/roles` (`src/app/(workspace)/roles/page.tsx`)

RSC first paint + client island for interaction (per the reversal decision: fast server-rendered list, client only where editable):

- **Server**: load roles + `userCount` via `query()` directly (RSC, no HTTP hop) and render the table: key (mono), name, description, `# users`, `is_system` badge, permission count. Row click → edit drawer.
- **Client island** (`RolesView`): create/edit drawer with name, description, and permission toggles grouped by `PERMISSION_GROUPS` (group header + one checkbox per `resource.verb`, labels from `PERMISSION_LABELS`). Wildcard-holding roles show an "All permissions (wildcard)" state with a "Customize" action that replaces `*` with the concrete expanded set (audited full-set replace).
- **Duplicate** button per row: opens the create drawer prefilled with the source role's resolved permissions (cheap replacement for inheritance).
- **Delete**: button disabled/explained for system roles; for roles with users, show `userCount` and the reassign guidance instead of a confirm dialog. Mutations call the roles API.

### Permission matrix page — `/permissions` (`src/app/(workspace)/permissions/page.tsx`)

> **Revision (2026-11-03, user):** shipped design is a per-role editor, not this matrix — a role selector on `/permissions` reveals grouped per-resource verb checkboxes (one Save per selected role). Sticky columns, per-column save and mobile collapse dissolve; cross-links, wildcard lock, own-role blocking carry over. See epic-rbac-admin-experience Notes and ticket 2.3.

Thin view over the roles API (the Kill-the-Crown-Jewel lesson: the API was built as if the matrix exists, so this is presentation only):

- `MatrixView` client island fed by `GET /api/roles`.
- **Rows** grouped by `PERMISSION_GROUPS` (group label row, verb sub-rows: `users` → view/create/update/delete), **columns = roles**. Cell = checkbox showing the role's *resolved* state.
- Sticky header row (role names) and sticky first column (resource labels) for scroll legibility at 5–50 roles.
- **Save per column**: a column goes dirty on any toggle; its header shows a Save button issuing `PATCH /api/roles/[key]/permissions` with the full replacement set. Success → toast + refetch. Columns whose raw grants contain a wildcard render read-only with a lock icon ("holds the `*` wildcard — edit in the role drawer").
- Collapses to stacked per-role editors on small screens (SHOULD).
- Empty state (no custom roles yet) invites creating one on `/roles`.

### Cross-links between the two pages (URL params)

- `/permissions?role=<key>` — scrolls to and highlights that role's column.
- `/roles?role=<key>` — opens that role's edit drawer on load.
- Matrix column header links to `/roles?role=<key>`; role drawer has an "Edit in matrix" link to `/permissions?role=<key>`.

---

## 7. Scope (MoSCoW)

**Must (v1)**

- `src/lib/permissions.ts` catalog incl. `watching` and `roles.*` resources, resolver, labels, `pageViewPermission`.
- Schema v3: `roles` + `role_audit` + `users.role` FK + 3 system-role seed, idempotent.
- `me` payload extended with resolved `permissions`.
- `requirePermission()` applied to all API routes (users GET/POST + all roles routes).
- Roles API: GET/POST `/api/roles`, PATCH/DELETE `/api/roles/[key]`, PATCH `/api/roles/[key]/permissions`.
- `/roles` master page (table, create/edit drawer, duplicate, delete-with-blocks).
- `/permissions` matrix page (grouped grid, roles as columns, per-column save).
- Sidebar filtering + `usePermission` + per-page 403 handling.
- Lockout guards (own-role, attached-users, last-holder) + audit writes on every mutation.
- Delete the hardcoded `ROLES` const (and users-view's `ROLE_OPTIONS`).

**Should**

- Dedicated 403 view reusing the not-found-view pattern.
- Matrix collapses to per-role editor on small screens.
- Duplicate-role button (also listed under Must's `/roles` page — the button itself is the Should-grade nicety).
- `me` re-fetch on window focus.

**Could**

- Preset templates (Viewer/Operator/Manager) on role create.
- Audit log viewer UI (table over `role_audit`).
- "Why is this disabled" tooltips showing which role would grant an action.

**Won't (parked)**

- `perm_version` claim / instant propagation — the 15-min TTL plus focus re-fetch is instant enough; a version claim complicates the refresh flow.
- Row-/field-level scoping — no consumer yet; keys are designed for a `.own` suffix later.
- User-level permission overrides — roles cover the need; a second grant path doubles the surface.
- Per-team roles — combinatorial explosion; global roles + future scope suffix cover the real need.
- Role inheritance — the duplicate button is the cheap substitute.
- Custom-verbs UI — new verbs are a one-line catalog edit; no UI to invent them at runtime.
- External authorization libs (Casbin/CASL/permit.io) — plain SQL + one helper suffices at this scale.
- Impersonation — new security surface, not asked for.

---

## 8. Open questions (each with a recommended default)

1. **Watching page gating** — `watching` is a special `WorkspaceRoute` absent from `ALL_PAGES`, so nothing would gate it unless the catalog says so explicitly.
   **Default:** include `watching.view` as an explicit catalog resource (done in §2); grant it to **all three** system roles (it is workspace content, not admin surface); gate the whole sidebar Watching section, the `/watching` page, and any future watching data API with it.
2. **Exact verb set per page** — e.g. does Ask AI need `use` beyond `view`; is Agent Board ever writable?
   **Default:** the table in §2 — `home: [view]`, `ask-ai: [view, use]` (`use` = send messages), `agent-board: [view]`, `watching: [view]`, `users: [view, create, update, delete]`, `roles: [view, manage]` (`view` = see the two admin pages, `manage` = mutate roles/permissions). Adding a verb later is a catalog-line edit with no migration, so under-granting now is cheap to fix.

---

## 9. Testing plan

Prerequisite: the repo currently has **no test runner** — add `vitest` (unit + API route tests) and `playwright` (e2e) as devDependencies first.

1. **Resolver unit tests** (`permissions.test.ts`, pure, fast):
   - `*` expands to all 11 keys; `users.*` expands to the 4 users keys.
   - Unknown concrete keys and unknown `foo.*` are dropped.
   - De-duplication and deterministic catalog order.
   - Catalog integrity: every `ALL_PAGES` id (+ `watching`) has a verbs entry; every generated key has a `PERMISSION_LABELS` entry; no orphan labels.
2. **Per-role API fixture tests** (against a seeded test DB): a fixture per role (`Admin`, `Editor`, `Member`, plus one custom role) × each guarded endpoint → expected `200`/`403` matrix. Includes:
   - `401` unauthenticated on every guarded route.
   - Guard coverage: own-role permissions edit → `403`; delete system role → `409`; delete role with attached users → `409` + `userCount`; last-`roles.manage`-holder strip → `409`; `POST /api/roles` with an unknown permission string → `400`; `POST /api/users` with an unknown role → `400`.
   - Audit: one `role_audit` row with correct `action`/`actor_id`/`diff` per mutation.
   - FK: `INSERT` with a non-existent role is rejected by the constraint.
3. **E2E per role happy path** (Playwright): sign in as each seeded role → sidebar shows exactly the permitted entries → direct deep-link to `/users` as Member renders the 403 view (not data) → Admin happy path: create role → toggle permissions in drawer → matrix reflects the change → permissions revoked for a second user take effect at the API on the next request and in the UI after a `me` re-fetch.

---

## 10. Build order

Sequenced so each step compiles and ships independently; the matrix UI lands last because it is a thin view over the roles API (the Kill-the-Crown-Jewel lesson — build the data model and API *as if* the matrix exists, and the sequencing risk disappears).

1. **Catalog + resolver** — `src/lib/permissions.ts` (pure, no deps) + its unit tests. Nothing else changes yet.
2. **Schema v3** — `ensureSchema()` additions in `src/lib/db.ts`; verify against both a fresh DB and an existing v2 DB (FK must add cleanly, seed must survive a restart untouched).
3. **Auth integration** — `SessionUser.permissions` (JOIN + `resolvePermissions`), `me` payload grows. *(Pulled ahead of the API step because `requirePermission` consumes it.)*
4. **API** — `permission-guard.ts`; guard `users` GET/POST; validate role against the `roles` table; delete `ROLES` and users-view's `ROLE_OPTIONS`; then the full roles API with validation, lockout guards, and audit writes.
5. **Client gating** — `PermissionProvider` in `DashboardShell`, `usePermission`, sidebar/command-palette/Watching filtering, `PagePermissionGate` + `ForbiddenView`.
6. **Pages** — `/roles` master (RSC list + drawer island + duplicate + delete blocks), then `/permissions` matrix (client island, sticky headers, per-column save), then the URL-param cross-links.
7. **Fixtures + e2e** — the §9 suites, run in CI alongside lint/build.

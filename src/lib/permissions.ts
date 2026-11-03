/**
 * The permission catalog — the single source of truth for every authorization
 * key in the app.
 *
 * Keys are `<resource>.<verb>` where resource is a `navigation.ts` page id, an
 * explicit non-nav resource (`watching`), or an admin resource (`roles`). The
 * database stores only grants (role → JSONB array of keys/wildcards); what a
 * grant *means* is decided here, in code. Adding a page = adding one catalog
 * entry; no migration.
 *
 * Pure module by contract: no `pg`, no `next/headers`, no server-only imports —
 * client components (sidebar, matrix UI) import this file too. It may reference
 * `navigation.ts` type-only.
 */
import type { ALL_PAGES } from "@/components/dashboard/navigation";

export type Verb = "view" | "create" | "update" | "delete" | "use" | "manage";

/** Nav-page ids that require a verbs entry. `watching` is a WorkspaceRoute that
 *  is not part of ALL_PAGES, so it is added explicitly here. */
type NavPageId = (typeof ALL_PAGES)[number]["id"] | "watching";

/** Record<NavPageId, ...> makes TypeScript fail the build when a page is added
 *  to navigation.ts without a verbs entry — the single-source-of-truth check.
 *  Declaration order is the catalog order (workspace pages, then watching,
 *  then admin); these keys are non-numeric so object insertion order holds. */
const VERBS_BY_PAGE: Record<NavPageId, readonly Verb[]> = {
  home: ["view"],
  "ask-ai": ["view", "use"],
  "agent-board": ["view"],
  watching: ["view"],
  users: ["view", "create", "update", "delete"],
};

/** Non-page admin resources. */
const EXTRA_RESOURCES: ReadonlyArray<{ resource: string; verbs: readonly Verb[] }> = [
  { resource: "roles", verbs: ["view", "manage"] },
];

/** Human group heading per resource — the matrix UI's row groups and the i18n
 *  base. Keys are stable resource ids; labels are the translatable surface. */
const RESOURCE_LABELS: Record<string, string> = {
  home: "Home",
  "ask-ai": "Ask AI",
  "agent-board": "Agent Board",
  watching: "Watching",
  users: "Users",
  roles: "Roles",
};

export interface ResourceGroup {
  resource: string;
  /** Group heading in matrix UI + i18n base. */
  label: string;
  verbs: readonly Verb[];
}

function groupOf(resource: string, verbs: readonly Verb[]): ResourceGroup {
  return { resource, label: RESOURCE_LABELS[resource] ?? resource, verbs };
}

/** Ordered for UI display: workspace pages, then watching, then admin. */
export const PERMISSION_GROUPS: readonly ResourceGroup[] = [
  ...(Object.entries(VERBS_BY_PAGE) as Array<[NavPageId, readonly Verb[]]>).map(
    ([id, verbs]) => groupOf(id, verbs)
  ),
  ...EXTRA_RESOURCES.map(({ resource, verbs }) => groupOf(resource, verbs)),
];

/** Every valid concrete key, e.g. ["home.view", "ask-ai.view", ..., "roles.manage"]. */
export const ALL_PERMISSION_KEYS: readonly string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.verbs.map((verb) => `${group.resource}.${verb}`)
);

const KEY_SET: ReadonlySet<string> = new Set(ALL_PERMISSION_KEYS);
const GROUP_BY_RESOURCE: ReadonlyMap<string, ResourceGroup> = new Map(
  PERMISSION_GROUPS.map((group) => [group.resource, group])
);

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

/** Sidebar/page gate for a nav page id. Default `${id}.view`; the matrix page
 *  shares the roles resource's view verb — the catalog has no `permissions.*`
 *  resource, so one explicit override keeps "nav id → key" a function. */
export function pageViewPermission(pageId: string): string {
  return pageId === "permissions" ? "roles.view" : `${pageId}.view`;
}

/**
 * Expand wildcards against the catalog and drop unknown/dead grants.
 *
 * Rules:
 *   1. `"*"` → all of ALL_PERMISSION_KEYS.
 *   2. `"<resource>.*"` with a known resource → that group's keys; unknown
 *      resource → dropped.
 *   3. A concrete key not in ALL_PERMISSION_KEYS → dropped (dead grants are
 *      inert; stale data can never grant a permission the code no longer defines).
 *   4. Output is de-duplicated and in PERMISSION_GROUPS order, then verb order
 *      — deterministic, snapshot-testable.
 *
 * Invariant: the output NEVER contains `*` or `resource.*` entries.
 */
export function resolvePermissions(granted: readonly string[]): string[] {
  const wanted = new Set<string>();
  for (const entry of granted) {
    if (entry === "*") {
      for (const key of ALL_PERMISSION_KEYS) wanted.add(key);
      continue;
    }
    if (entry.endsWith(".*")) {
      const group = GROUP_BY_RESOURCE.get(entry.slice(0, -2));
      if (group) {
        for (const verb of group.verbs) wanted.add(`${group.resource}.${verb}`);
      }
      continue;
    }
    if (KEY_SET.has(entry)) wanted.add(entry);
  }
  return ALL_PERMISSION_KEYS.filter((key) => wanted.has(key));
}

/** Membership test against an already-resolved list. */
export function hasPermission(resolved: readonly string[], required: string): boolean {
  return resolved.includes(required);
}

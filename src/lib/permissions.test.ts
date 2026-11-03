import { describe, expect, it } from "vitest";
import { ALL_PAGES } from "@/components/dashboard/navigation";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  hasPermission,
  isValidGrant,
  pageViewPermission,
  resolvePermissions,
  wouldLeaveNoManageHolder,
  type RoleGrantsUsage,
} from "./permissions";

/** The full v1 catalog in display order — the deterministic order the resolver
 *  must emit regardless of grant order or duplicates. */
const CATALOG_ORDER = [
  "home.view",
  "ask-ai.view",
  "ask-ai.use",
  "agent-board.view",
  "watching.view",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "roles.view",
  "roles.manage",
] as const;

const USERS_KEYS = ["users.view", "users.create", "users.update", "users.delete"] as const;

describe("resolvePermissions", () => {
  it('expands "*" to the whole catalog, with no wildcard in the output', () => {
    const resolved = resolvePermissions(["*"]);
    expect(resolved).toEqual([...CATALOG_ORDER]);
    expect(resolved).toEqual([...ALL_PERMISSION_KEYS]);
    expect(resolved).not.toContain("*");
    expect(resolved.filter((key) => key.endsWith(".*"))).toEqual([]);
  });

  it('expands a known resource wildcard to that resource\'s keys only', () => {
    expect(resolvePermissions(["users.*"])).toEqual([...USERS_KEYS]);
    expect(resolvePermissions(["roles.*"])).toEqual(["roles.view", "roles.manage"]);
  });

  it("drops unknown concrete keys and unknown resource wildcards (dead grants are inert)", () => {
    expect(resolvePermissions(["retired.thing", "foo.*", "users.view"])).toEqual(["users.view"]);
    expect(resolvePermissions(["nope.view", "users.nope", ".*"])).toEqual([]);
  });

  it("de-duplicates grants and emits deterministic catalog order", () => {
    // Reverse-order, duplicated, overlapping concrete + wildcard grants.
    const resolved = resolvePermissions([
      "users.delete",
      "home.view",
      "users.view",
      "users.*",
      "home.view",
      "agent-board.view",
    ]);
    expect(resolved).toEqual(["home.view", "agent-board.view", ...USERS_KEYS]);
  });

  it("resolves an empty grant list to an empty permission list", () => {
    expect(resolvePermissions([])).toEqual([]);
  });

  it("never grants more than the catalog defines", () => {
    for (const key of resolvePermissions(["*", "users.*", "roles.manage", "bogus"])) {
      expect(ALL_PERMISSION_KEYS).toContain(key);
    }
  });
});

describe("isValidGrant", () => {
  it("accepts the global wildcard", () => {
    expect(isValidGrant("*")).toBe(true);
  });

  it("accepts a wildcard for every resource the catalog defines", () => {
    for (const group of PERMISSION_GROUPS) {
      expect(isValidGrant(`${group.resource}.*`), `${group.resource}.*`).toBe(true);
    }
  });

  it("accepts every concrete catalog key", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(isValidGrant(key), key).toBe(true);
    }
  });

  it("rejects unknown concrete keys", () => {
    expect(isValidGrant("banana.peel")).toBe(false);
    expect(isValidGrant("users.nope")).toBe(false);
    expect(isValidGrant("retired.thing")).toBe(false);
  });

  it("rejects wildcards for resources the catalog does not define", () => {
    expect(isValidGrant("foo.*")).toBe(false);
    expect(isValidGrant(".*")).toBe(false);
  });

  it("rejects malformed entries", () => {
    expect(isValidGrant("")).toBe(false);
    expect(isValidGrant("*.*")).toBe(false);
    expect(isValidGrant("*.view")).toBe(false);
    expect(isValidGrant("users")).toBe(false);
    expect(isValidGrant("users.")).toBe(false);
    expect(isValidGrant(".view")).toBe(false);
    expect(isValidGrant(" users.view ")).toBe(false);
    expect(isValidGrant("USERS.VIEW")).toBe(false);
  });

  it("agrees with the resolver: every accepted grant resolves to something", () => {
    const accepted = ["*", "users.*", "roles.manage"];
    for (const grant of accepted) {
      expect(resolvePermissions([grant]).length, grant).toBeGreaterThan(0);
    }
    // And every rejected grant resolves to nothing on its own.
    for (const grant of ["banana.peel", "foo.*", "*.view"]) {
      expect(resolvePermissions([grant]), grant).toEqual([]);
    }
  });
});

describe("hasPermission", () => {
  it("is plain membership over the resolved list", () => {
    const member = resolvePermissions(["home.view", "watching.view"]);
    expect(hasPermission(member, "home.view")).toBe(true);
    expect(hasPermission(member, "users.view")).toBe(false);
  });

  it("denies everything for an empty permission list", () => {
    expect(hasPermission([], "home.view")).toBe(false);
  });
});

describe("pageViewPermission", () => {
  it("maps every nav page id to its own view key", () => {
    for (const page of ALL_PAGES) {
      // Widen to string: "permissions" is not in today's ALL_PAGES id union,
      // but the override must hold the moment epic 2 adds that id — a narrow
      // comparison would be a type error today (TS2367).
      const id: string = page.id;
      // The permissions matrix page deliberately shares the roles resource's
      // view verb.
      const expected = id === "permissions" ? "roles.view" : `${id}.view`;
      expect(pageViewPermission(id)).toBe(expected);
    }
    expect(pageViewPermission("watching")).toBe("watching.view");
  });

  it("routes the permissions matrix page through the roles resource", () => {
    expect(pageViewPermission("permissions")).toBe("roles.view");
  });
});

describe("catalog integrity", () => {
  it("defines exactly the 11 v1 keys, in catalog order", () => {
    expect(ALL_PERMISSION_KEYS).toEqual([...CATALOG_ORDER]);
    expect(ALL_PERMISSION_KEYS).toHaveLength(11);
  });

  it("has a verbs entry for every nav page id plus watching", () => {
    const resources = new Set(PERMISSION_GROUPS.map((group) => group.resource));
    for (const page of ALL_PAGES) {
      expect(resources).toContain(page.id);
    }
    expect(resources).toContain("watching");
    // Every gated page must at least be viewable — the sidebar gate is `<id>.view`.
    for (const id of [...ALL_PAGES.map((page) => page.id), "watching"]) {
      const group = PERMISSION_GROUPS.find((candidate) => candidate.resource === id);
      expect(group?.verbs).toContain("view");
    }
  });

  it("orders groups workspace-first, then watching, then admin", () => {
    expect(PERMISSION_GROUPS.map((group) => group.resource)).toEqual([
      "home",
      "ask-ai",
      "agent-board",
      "watching",
      "users",
      "roles",
    ]);
  });

  it("labels every key", () => {
    for (const key of ALL_PERMISSION_KEYS) {
      expect(PERMISSION_LABELS[key], `missing label for ${key}`).toBeTruthy();
    }
  });

  it("has no orphan labels", () => {
    const labelKeys = Object.keys(PERMISSION_LABELS);
    expect(labelKeys).toHaveLength(ALL_PERMISSION_KEYS.length);
    for (const key of labelKeys) {
      expect(ALL_PERMISSION_KEYS, `orphan label ${key}`).toContain(key);
    }
  });
});

describe("wouldLeaveNoManageHolder", () => {
  const MANAGE = "roles.manage";

  it("returns true when the sole holder role is stripped of manage", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "support", grants: [MANAGE], userCount: 2 },
      { key: "viewer", grants: ["home.view"], userCount: 5 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "support", ["home.view"])).toBe(true);
  });

  it("returns false when another role still holds manage explicitly", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "ops-a", grants: [MANAGE], userCount: 2 },
      { key: "ops-b", grants: [MANAGE], userCount: 1 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "ops-a", ["home.view"])).toBe(false);
  });

  it("returns false when another role holds manage via a wildcard (`*` or `roles.*`)", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "ops-a", grants: [MANAGE], userCount: 2 },
      { key: "ops-star", grants: ["*"], userCount: 1 },
      { key: "ops-group", grants: ["roles.*"], userCount: 1 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "ops-a", ["home.view"])).toBe(false);
    expect(wouldLeaveNoManageHolder(entries, "ops-star", ["home.view"])).toBe(false);
    expect(wouldLeaveNoManageHolder(entries, "ops-group", ["home.view"])).toBe(false);
  });

  it("returns false when the edit adds manage to a role that has users", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "ops", grants: [MANAGE], userCount: 0 },
      { key: "support", grants: ["home.view"], userCount: 3 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "support", [MANAGE])).toBe(false);
  });

  it("returns true when the only holder role has zero users (already locked out)", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "ops", grants: [MANAGE], userCount: 0 },
      { key: "support", grants: ["home.view"], userCount: 2 },
    ];
    // Editing a different role while nobody actually holds manage anywhere.
    expect(wouldLeaveNoManageHolder(entries, "support", ["users.view"])).toBe(true);
  });

  it("returns false when the edited role was never a holder and another role holds", () => {
    const entries: RoleGrantsUsage[] = [
      { key: "admin", grants: ["*"], userCount: 5 },
      { key: "support", grants: ["home.view"], userCount: 2 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "support", ["users.view"])).toBe(false);
  });

  it("evaluates dead grants as non-holding, matching the resolver", () => {
    // A "holder" whose only manage grant is a dead key resolves to nothing.
    const entries: RoleGrantsUsage[] = [
      { key: "stale", grants: ["roles.manage.retired"], userCount: 4 },
    ];
    expect(wouldLeaveNoManageHolder(entries, "stale", ["home.view"])).toBe(true);
  });
});

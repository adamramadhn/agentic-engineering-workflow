import { describe, expect, it } from "vitest";
import { ALL_PAGES } from "@/components/dashboard/navigation";
import {
  ALL_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  hasPermission,
  pageViewPermission,
  resolvePermissions,
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

import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { isValidGrant, resolvePermissions } from "@/lib/permissions";

/** Row shape of the roles × users aggregate. pg delivers the JSONB permissions
 *  column already parsed into a JS value (array — or anything, if the JSONB is
 *  malformed), so it is typed unknown and filtered defensively below. */
interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: unknown;
  is_system: boolean;
  created_at: Date;
  user_count: number;
}

/** The role shape shared by GET list items and POST's 201 body — one object so
 *  the create response can never drift from the list response. */
interface RoleResponse {
  key: string;
  name: string;
  description: string;
  /** Raw stored grants — may contain wildcards; this is the editable state. */
  permissions: string[];
  /** Wildcards expanded against the catalog — what the role actually allows. */
  resolvedPermissions: string[];
  isSystem: boolean;
  userCount: number;
  createdAt: string;
}

/** JSONB is typed unknown; anything that is not a string[] degrades to []. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toRoleResponse(row: Pick<RoleRow, "key" | "name" | "description" | "permissions" | "is_system" | "created_at">, userCount: number): RoleResponse {
  const permissions = toStringArray(row.permissions);
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    permissions,
    resolvedPermissions: resolvePermissions(permissions),
    isSystem: row.is_system,
    userCount,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function listRoles(): Promise<RoleResponse[]> {
  const result = await query<RoleRow>(
    `SELECT r.key, r.name, r.description, r.permissions, r.is_system, r.created_at,
            COUNT(u.id)::int AS user_count
     FROM roles r
     LEFT JOIN users u ON u.role = r.key
     GROUP BY r.key, r.name, r.description, r.permissions, r.is_system, r.created_at
     ORDER BY r.created_at ASC, r.key ASC`
  );
  return result.rows.map((row) => toRoleResponse(row, Number(row.user_count ?? 0)));
}

/** Server-side key derivation: lowercase, every non-alphanumeric run collapses
 *  to a single hyphen, hyphens trimmed from both ends. A name with no letters
 *  or digits slugs to "" and is rejected by the caller. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** First free key for a slug: `slug`, then `slug-2`, `slug-3`, … — one lookup
 *  for the whole candidate list instead of a query per probe. */
async function deriveFreeKey(slug: string): Promise<string | null> {
  const candidates = [slug, ...Array.from({ length: 99 }, (_, i) => `${slug}-${i + 2}`)];
  const taken = await query<{ key: string }>(`SELECT key FROM roles WHERE key = ANY($1)`, [
    candidates,
  ]);
  const takenSet = new Set(taken.rows.map((row) => row.key));
  return candidates.find((candidate) => !takenSet.has(candidate)) ?? null;
}

export async function GET() {
  try {
    const guard = await requirePermission("roles.view");
    if (!guard.ok) return guard.response;
    const roles = await listRoles();
    return Response.json({ roles });
  } catch (error) {
    console.error("list roles failed:", error);
    return Response.json({ error: "Failed to load roles" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission("roles.manage");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description =
      typeof body?.description === "string" ? body.description.trim() : "";
    // A client-supplied `key` is deliberately never read — the key is always
    // derived server-side from the name (design §5 POST row).
    const permissions: unknown = body?.permissions;

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    // permissions is optional ([] = grants nothing) but when present it must be
    // an array of strings — every entry then validated as a catalog key or
    // wildcard. Anything else is a 400, before any INSERT runs.
    let grants: string[] = [];
    if (permissions !== undefined) {
      if (
        !Array.isArray(permissions) ||
        permissions.some((entry: unknown) => typeof entry !== "string")
      ) {
        return Response.json(
          { error: "Permissions must be an array of permission keys" },
          { status: 400 }
        );
      }
      grants = permissions;
    }
    const invalid = grants.filter((grant) => !isValidGrant(grant));
    if (invalid.length > 0) {
      return Response.json(
        { error: "Unknown permission", invalidPermissions: invalid },
        { status: 400 }
      );
    }

    const slug = slugify(name);
    if (!slug) {
      return Response.json(
        { error: "Name must contain letters or numbers" },
        { status: 400 }
      );
    }

    // Validation is fully done before this line — a 400 never mutates.
    //
    // Probe-then-INSERT races a concurrent same-name create (e.g. a
    // double-clicked Create): both requests derive the same key, and a plain
    // INSERT would turn the loser into a unique-violation 500. ON CONFLICT DO
    // NOTHING makes the loser observable as an empty RETURNING instead; it
    // then re-derives (the probe now sees the winner's committed key) and
    // retries, bounded. Exhausting the loop (or the probe's candidate list)
    // falls through to the same 409.
    let role: RoleResponse | null = null;
    for (let attempt = 0; attempt < 3 && role === null; attempt++) {
      const key = await deriveFreeKey(slug);
      if (key === null) break;
      const result = await query<RoleRow>(
        `INSERT INTO roles (key, name, description, permissions, is_system)
         VALUES ($1, $2, $3, $4::jsonb, false)
         ON CONFLICT (key) DO NOTHING
         RETURNING key, name, description, permissions, is_system, created_at`,
        [key, name, description, JSON.stringify(grants)]
      );
      if (result.rows.length > 0) {
        role = toRoleResponse(result.rows[0], 0);
      }
    }
    if (role === null) {
      return Response.json(
        { error: "Could not derive a unique key for this name" },
        { status: 409 }
      );
    }

    // Audit after the mutation, sequential (not fire-and-forget) but
    // non-fatal: insurance, not a transactional participant (design §5).
    try {
      await query(
        `INSERT INTO role_audit (actor_id, action, role_key, diff)
         VALUES ($1, 'role.created', $2, $3::jsonb)`,
        [guard.user.id, role.key, JSON.stringify({ name, permissions: grants })]
      );
    } catch (error) {
      console.error("role audit write failed:", error);
    }

    return Response.json({ role }, { status: 201 });
  } catch (error) {
    console.error("create role failed:", error);
    return Response.json({ error: "Failed to create role" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import {
  isValidGrant,
  resolvePermissions,
  wouldLeaveNoManageHolder,
  type RoleGrantsUsage,
} from "@/lib/permissions";

/** Row shapes. pg delivers the JSONB permissions column already parsed into a
 *  JS value (array — or anything, if the JSONB is malformed), so it is typed
 *  unknown and filtered defensively. */
interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: unknown;
  is_system: boolean;
  created_at: Date;
}

/** The role shape 1.3's GET/POST return (minus userCount, which a grants
 *  replace never changes) — duplicated locally rather than imported across
 *  route files; the epic's entry 5 consolidates shared mapping helpers. */
interface RoleResponse {
  key: string;
  name: string;
  description: string;
  /** Raw stored grants — may contain wildcards; this is the editable state. */
  permissions: string[];
  /** Wildcards expanded against the catalog — what the role actually allows. */
  resolvedPermissions: string[];
  isSystem: boolean;
  createdAt: string;
}

/** JSONB is typed unknown; anything that is not a string[] degrades to []. */
function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function toRoleResponse(row: RoleRow): RoleResponse {
  const permissions = toStringArray(row.permissions);
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    permissions,
    resolvedPermissions: resolvePermissions(permissions),
    isSystem: row.is_system,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Full-set grants replace: the body's array IS the new grants list (no
 *  merge protocol). Guard order is load-bearing — every check runs before any
 *  write, and each failure mode is distinguishable by status:
 *    404 unknown role → 403 own-role edit → 400 invalid body → 409 lockout.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const guard = await requirePermission("roles.manage");
    if (!guard.ok) return guard.response;

    const { key } = await params;

    const existing = await query<RoleRow>(
      `SELECT key, name, description, permissions, is_system, created_at
       FROM roles WHERE key = $1`,
      [key]
    );
    if (existing.rows.length === 0) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const before = existing.rows[0];

    // Guard 2: an actor editing their own role could self-escalate (add grants
    // to their session) or self-lockout (strip everyone's manage) — both via
    // one row. Editing your own role's grants is simply not allowed.
    if (key === guard.user.role) {
      return Response.json(
        { error: "You cannot edit the permissions of your own role" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const permissions: unknown = body?.permissions;
    if (!Array.isArray(permissions) || permissions.some((entry) => typeof entry !== "string")) {
      return Response.json(
        { error: "Permissions must be an array of permission keys" },
        { status: 400 }
      );
    }
    const grants = permissions;
    const invalid = grants.filter((grant) => !isValidGrant(grant));
    if (invalid.length > 0) {
      return Response.json({ error: "Unknown permission", invalidPermissions: invalid }, { status: 400 });
    }

    // Guard 3 (defense-in-depth — guards 1+2 make it near-unreachable): would
    // this replace leave zero users able to administer roles? One aggregate
    // query feeds the pure computation every role's grants and user count.
    const usage = await query<{ key: string; permissions: unknown; user_count: number }>(
      `SELECT r.key, r.permissions, COUNT(u.id)::int AS user_count
       FROM roles r
       LEFT JOIN users u ON u.role = r.key
       GROUP BY r.key, r.permissions`,
      []
    );
    const entries: RoleGrantsUsage[] = usage.rows.map((row) => ({
      key: row.key,
      grants: toStringArray(row.permissions),
      userCount: Number(row.user_count ?? 0),
    }));
    if (wouldLeaveNoManageHolder(entries, key, grants)) {
      return Response.json(
        { error: "This change would remove the last holder of roles.manage" },
        { status: 409 }
      );
    }

    const result = await query<RoleRow>(
      `UPDATE roles SET permissions = $2::jsonb WHERE key = $1
       RETURNING key, name, description, permissions, is_system, created_at`,
      [key, JSON.stringify(grants)]
    );
    // A concurrent DELETE of this role can commit between the SELECT above and
    // this UPDATE; 0 updated rows means it is gone — 404 BEFORE the audit
    // write, which would otherwise record a replace that never happened.
    if (result.rows.length === 0) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    // Audit after the mutation, sequential (not fire-and-forget) but
    // non-fatal: insurance, not a transactional participant (design §5).
    try {
      await query(
        `INSERT INTO role_audit (actor_id, action, role_key, diff)
         VALUES ($1, 'role.permissions.replaced', $2, $3::jsonb)`,
        [
          guard.user.id,
          key,
          JSON.stringify({ before: toStringArray(before.permissions), after: grants }),
        ]
      );
    } catch (error) {
      console.error("role audit write failed:", error);
    }

    return Response.json({ role: toRoleResponse(result.rows[0]) });
  } catch (error) {
    console.error("replace role permissions failed:", error);
    return Response.json({ error: "Failed to replace role permissions" }, { status: 500 });
  }
}

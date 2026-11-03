import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { resolvePermissions } from "@/lib/permissions";

/** Row shape of a single roles row (no user aggregate here — rename/delete
 *  never needs the count in the response body). pg delivers the JSONB
 *  permissions column already parsed into a JS value (array — or anything, if
 *  the JSONB is malformed), so it is typed unknown and filtered defensively. */
interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: unknown;
  is_system: boolean;
  created_at: Date;
}

/** The role shape 1.3's GET/POST return (minus userCount, which rename/delete
 *  never changes) — duplicated locally rather than imported across route files;
 *  the epic's entry 5 consolidates shared mapping helpers. */
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

const SELECT_ROLE = `SELECT key, name, description, permissions, is_system, created_at
  FROM roles WHERE key = $1`;

/** Rename / re-describe a role. The key is the URL's alone: a body `key` is
 *  never read (keys are immutable), and only name/description are writable —
 *  on system roles too. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const guard = await requirePermission("roles.manage");
    if (!guard.ok) return guard.response;

    const { key } = await params;

    const existing = await query<RoleRow>(SELECT_ROLE, [key]);
    if (existing.rows.length === 0) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const before = existing.rows[0];

    const body = await request.json().catch(() => null);
    const rawName = body?.name;
    const rawDescription = body?.description;

    if (rawName === undefined && rawDescription === undefined) {
      return Response.json(
        { error: "Nothing to update: provide name or description" },
        { status: 400 }
      );
    }
    if (rawName !== undefined && typeof rawName !== "string") {
      return Response.json({ error: "Name must be a string" }, { status: 400 });
    }
    if (rawDescription !== undefined && typeof rawDescription !== "string") {
      return Response.json({ error: "Description must be a string" }, { status: 400 });
    }
    const name = rawName?.trim();
    if (rawName !== undefined && !name) {
      return Response.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    const description = rawDescription?.trim();

    // null = "leave unchanged" — COALESCE applies only the fields the body sent.
    const result = await query<RoleRow>(
      `UPDATE roles
       SET name = COALESCE($2, name),
           description = COALESCE($3, description)
       WHERE key = $1
       RETURNING key, name, description, permissions, is_system, created_at`,
      [key, name ?? null, description ?? null]
    );
    // A concurrent DELETE of this role can commit between the SELECT above and
    // this UPDATE; 0 updated rows means it is gone — 404, not rows[0] blowing
    // up below, and no audit row for a mutation that never happened.
    if (result.rows.length === 0) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const after = result.rows[0];

    // Audit after the mutation, sequential (not fire-and-forget) but
    // non-fatal: insurance, not a transactional participant (design §5).
    try {
      await query(
        `INSERT INTO role_audit (actor_id, action, role_key, diff)
         VALUES ($1, 'role.updated', $2, $3::jsonb)`,
        [
          guard.user.id,
          key,
          JSON.stringify({
            before: { name: before.name, description: before.description },
            after: { name: after.name, description: after.description },
          }),
        ]
      );
    } catch (error) {
      console.error("role audit write failed:", error);
    }

    return Response.json({ role: toRoleResponse(after) });
  } catch (error) {
    console.error("update role failed:", error);
    return Response.json({ error: "Failed to update role" }, { status: 500 });
  }
}

/** Delete a custom role — never a system role, never one that still has users
 *  (reassign them first; the users.role FK would otherwise orphan them). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const guard = await requirePermission("roles.manage");
    if (!guard.ok) return guard.response;

    const { key } = await params;

    const existing = await query<RoleRow>(SELECT_ROLE, [key]);
    if (existing.rows.length === 0) {
      return Response.json({ error: "Role not found" }, { status: 404 });
    }
    const role = existing.rows[0];

    if (role.is_system) {
      return Response.json({ error: "System roles cannot be deleted" }, { status: 409 });
    }

    // In-use check and delete as one statement. With a plain count-then-delete,
    // a user attached between the two queries would make the DELETE raise an
    // FK violation (users_role_fkey) → 500. NOT EXISTS decides atomically
    // inside the statement; 0 returned rows means the delete was blocked or the
    // role vanished to a concurrent delete — the count re-read says which.
    const deleted = await query<{ name: string }>(
      `DELETE FROM roles WHERE key = $1 AND NOT EXISTS (SELECT 1 FROM users WHERE role = $1)
       RETURNING name`,
      [key]
    );
    if (deleted.rows.length === 0) {
      const usage = await query<{ user_count: number }>(
        `SELECT COUNT(*)::int AS user_count FROM users WHERE role = $1`,
        [key]
      );
      const userCount = Number(usage.rows[0]?.user_count ?? 0);
      if (userCount > 0) {
        return Response.json(
          {
            error: `Role is still assigned to ${userCount} user${userCount === 1 ? "" : "s"} — reassign them to another role before deleting`,
            userCount,
          },
          { status: 409 }
        );
      }
      return Response.json({ error: "Role not found" }, { status: 404 });
    }

    // Audit after the mutation, sequential (not fire-and-forget) but
    // non-fatal: insurance, not a transactional participant (design §5).
    // role_key is a raw string, not an FK — the row must outlive the role.
    try {
      await query(
        `INSERT INTO role_audit (actor_id, action, role_key, diff)
         VALUES ($1, 'role.deleted', $2, $3::jsonb)`,
        [guard.user.id, key, JSON.stringify({ name: deleted.rows[0]?.name ?? role.name })]
      );
    } catch (error) {
      console.error("role audit write failed:", error);
    }

    return Response.json({ deleted: true });
  } catch (error) {
    console.error("delete role failed:", error);
    return Response.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

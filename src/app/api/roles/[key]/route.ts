import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { toRoleResponse, writeRoleAudit, type RoleRow } from "@/lib/roles";

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
    await writeRoleAudit({
      actorId: guard.user.id,
      action: "role.updated",
      roleKey: key,
      diff: {
        before: { name: before.name, description: before.description },
        after: { name: after.name, description: after.description },
      },
    });

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
    await writeRoleAudit({
      actorId: guard.user.id,
      action: "role.deleted",
      roleKey: key,
      diff: { name: deleted.rows[0]?.name ?? role.name },
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error("delete role failed:", error);
    return Response.json({ error: "Failed to delete role" }, { status: 500 });
  }
}

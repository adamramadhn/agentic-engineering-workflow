import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { isUuid, normalizeLabelName, writeWikiAudit } from "@/lib/wiki";

/** pg error code 23505 — unique_violation on wiki_labels.name. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && (error as { code?: string }).code === "23505";
}

/** PATCH /api/wiki/labels/[id] — rename. Page links follow by id, not name. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.update");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Label not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const raw = (body ?? {}) as { name?: unknown };
    const name = typeof raw.name === "string" ? normalizeLabelName(raw.name) : "";
    if (!name) {
      return Response.json({ error: "Label name is required" }, { status: 400 });
    }

    let renamed: { id: string; name: string; created_at: Date } | undefined;
    try {
      const result = await query<{ id: string; name: string; created_at: Date }>(
        `UPDATE wiki_labels SET name = $2 WHERE id = $1 RETURNING id, name, created_at`,
        [id, name]
      );
      renamed = result.rows[0];
    } catch (error) {
      if (isUniqueViolation(error)) {
        return Response.json({ error: "A label with that name already exists" }, { status: 409 });
      }
      throw error;
    }
    if (!renamed) {
      return Response.json({ error: "Label not found" }, { status: 404 });
    }

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "label.updated",
      target: `label:${id}`,
      diff: { name },
    });

    return Response.json({
      label: { id: renamed.id, name: renamed.name, createdAt: new Date(renamed.created_at).toISOString() },
    });
  } catch (error) {
    console.error("rename wiki label failed:", error);
    return Response.json({ error: "Failed to rename label" }, { status: 500 });
  }
}

/**
 * DELETE /api/wiki/labels/[id] — the label row dies and wiki_page_labels
 * cascades with it; pages survive untouched.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.update");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Label not found" }, { status: 404 });
    }

    const deleted = await query<{ name: string }>(
      `DELETE FROM wiki_labels WHERE id = $1 RETURNING name`,
      [id]
    );
    if (deleted.rows.length === 0) {
      return Response.json({ error: "Label not found" }, { status: 404 });
    }

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "label.deleted",
      target: `label:${id}`,
      diff: { name: deleted.rows[0].name },
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error("delete wiki label failed:", error);
    return Response.json({ error: "Failed to delete label" }, { status: 500 });
  }
}

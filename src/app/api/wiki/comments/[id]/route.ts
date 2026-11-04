import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { hasPermission } from "@/lib/permissions";
import { isUuid, writeWikiAudit } from "@/lib/wiki";

/**
 * DELETE /api/wiki/comments/[id] — the one wiki route whose decision is not a
 * single permission key.
 *
 * Entry gate: `wiki.view` — the read gate, NOT `wiki.comment`. Gating entry on
 * the ability to comment would break two real actors a /permissions edit can
 * construct on an existing DB: a moderator granted `wiki.delete` without
 * `wiki.comment` could never moderate a foreign comment, and an author whose
 * comment grant was revoked could never retract their own words. Delete rule:
 * the AUTHOR may always remove their own comment; anyone holding `wiki.delete`
 * may moderate anyone's. The asymmetry is deliberate: being allowed to speak
 * is not being allowed to moderate, so a comment-only role can retract itself
 * but never a colleague.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.view");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    const existing = await query<{
      id: string;
      page_id: string;
      author_id: string | null;
    }>(`SELECT id, page_id, author_id FROM wiki_comments WHERE id = $1`, [id]);
    const comment = existing.rows[0];
    if (!comment) {
      return Response.json({ error: "Comment not found" }, { status: 404 });
    }

    const isAuthor = comment.author_id === guard.user.id;
    const canModerate = hasPermission(guard.user.permissions, "wiki.delete");
    if (!isAuthor && !canModerate) {
      return Response.json(
        { error: "Forbidden", requiredPermission: "wiki.delete" },
        { status: 403 }
      );
    }

    await query(`DELETE FROM wiki_comments WHERE id = $1`, [id]);

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "comment.deleted",
      target: `comment:${id}`,
      diff: { pageId: comment.page_id, asAuthor: isAuthor },
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error("delete wiki comment failed:", error);
    return Response.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

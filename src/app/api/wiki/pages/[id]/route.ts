import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { deletePrefix, isConfigured, readStorageSettings } from "@/lib/storage";
import {
  getWikiPageDetail,
  getWikiPageRow,
  isUuid,
  parseLabelIds,
  replacePageLabels,
  writeWikiAudit,
} from "@/lib/wiki";

const MAX_TITLE_LENGTH = 200;

async function filterUnknownLabelIds(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const result = await query<{ id: string }>(
    `SELECT id FROM wiki_labels WHERE id = ANY($1::uuid[])`,
    [[...new Set(ids)]]
  );
  const known = new Set(result.rows.map((row) => row.id));
  return [...new Set(ids)].filter((id) => !known.has(id));
}

/** GET /api/wiki/pages/[id] — page + labels + comments + attachments. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.view");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }
    const page = await getWikiPageDetail(id);
    if (!page) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }
    return Response.json({ page });
  } catch (error) {
    console.error("read wiki page failed:", error);
    return Response.json({ error: "Failed to read wiki page" }, { status: 500 });
  }
}

/**
 * PATCH /api/wiki/pages/[id] — save the document (and/or title, and/or the
 * label set). Everything is validated before the first statement so a 400
 * leaves the page exactly as it was: no partial write.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.update");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const raw = (body ?? {}) as {
      title?: unknown;
      content?: unknown;
    };

    const hasTitle = raw.title !== undefined;
    const title = typeof raw.title === "string" ? raw.title.trim() : "";
    if (hasTitle && !title) {
      return Response.json({ error: "Title cannot be empty" }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return Response.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    // content may be explicitly null (a page saved empty) but never anything
    // that is not an object — a string/number here means a client bug, and
    // storing it would render a page the editor cannot reopen.
    const hasContent = raw.content !== undefined;
    if (hasContent && raw.content !== null && typeof raw.content !== "object") {
      return Response.json({ error: "Content must be a tiptap JSON object" }, { status: 400 });
    }

    const labelIds = parseLabelIds(body);
    if (labelIds !== null) {
      const invalidLabelIds = await filterUnknownLabelIds(labelIds);
      if (invalidLabelIds.length > 0) {
        return Response.json(
          { error: "Unknown label ids", invalidLabelIds },
          { status: 400 }
        );
      }
    }

    const existing = await getWikiPageRow(id);
    if (!existing) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    const updated = await query(
      `UPDATE wiki_pages
       SET title      = COALESCE($2, title),
           content    = COALESCE($3::jsonb, content),
           updated_by = $4,
           updated_at = now()
       WHERE id = $1`,
      [
        id,
        hasTitle ? title : null,
        hasContent ? JSON.stringify(raw.content) : null,
        guard.user.id,
      ]
    );

    if (labelIds !== null) {
      await replacePageLabels(id, labelIds);
    }

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "page.updated",
      target: `page:${id}`,
      diff: {
        title: hasTitle ? title : existing.title,
        contentSaved: hasContent,
        labels: labelIds === null ? undefined : labelIds.length,
      },
    });

    const page = await getWikiPageDetail(id);
    return Response.json({ page, rowsUpdated: updated.rowCount });
  } catch (error) {
    console.error("update wiki page failed:", error);
    return Response.json({ error: "Failed to update wiki page" }, { status: 500 });
  }
}

/**
 * DELETE /api/wiki/pages/[id] — comments, label links and attachment rows
 * cascade in Postgres. The S3 objects do not: the best-effort prefix wipe
 * below runs AFTER the row delete and its failure is logged, never blocking —
 * the page is already gone, and orphaned objects are a cheaper failure than a
 * page that refuses to die.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.delete");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    // Which prefixes will the cascade orphan? Read before the delete.
    const attachments = await query<{ s3_key: string }>(
      `SELECT s3_key FROM wiki_attachments WHERE page_id = $1`,
      [id]
    );

    const deleted = await query<{ title: string }>(
      `DELETE FROM wiki_pages WHERE id = $1 RETURNING title`,
      [id]
    );
    if (deleted.rows.length === 0) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    await cleanupPageObjects(attachments.rows.map((row) => row.s3_key));

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "page.deleted",
      target: `page:${id}`,
      diff: { title: deleted.rows[0].title, attachments: attachments.rows.length },
    });

    return Response.json({ deleted: true });
  } catch (error) {
    console.error("delete wiki page failed:", error);
    return Response.json({ error: "Failed to delete wiki page" }, { status: 500 });
  }
}

/**
 * Best-effort prefix cleanup. Keys are `${prefix}/${pageId}/…`, so one call
 * per distinct prefix covers every attachment the page had. Any failure is
 * logged and swallowed by contract — the rows are already gone.
 */
async function cleanupPageObjects(keys: readonly string[]): Promise<void> {
  if (keys.length === 0) return;
  const prefixes = new Set(keys.map((key) => key.split("/").slice(0, -1).join("/")));
  const settings = await readStorageSettings();
  if (!settings || !isConfigured(settings)) {
    console.warn(
      `[wiki] skipping S3 cleanup (${prefixes.size} prefix(es)) — storage not configured`
    );
    return;
  }
  try {
    for (const prefix of prefixes) {
      const removed = await deletePrefix(settings, prefix);
      console.info(`[wiki] page cleanup removed ${removed} object(s) under ${prefix}`);
    }
  } catch (error) {
    console.error("[wiki] S3 prefix cleanup failed:", error);
  }
}

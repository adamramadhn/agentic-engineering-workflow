import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { isUuid, listPageComments, writeWikiAudit } from "@/lib/wiki";

/** Long enough for a real remark, short enough to keep a thread readable. */
const MAX_COMMENT_LENGTH = 5000;

/**
 * POST /api/wiki/pages/[id]/comments — append to the discussion. The response
 * carries author + timestamp; the author_id is the session's, never a body
 * field, so a client cannot forge someone else's name on a row.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.comment");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const raw = (body ?? {}) as { body?: unknown };
    const text = typeof raw.body === "string" ? raw.body.trim() : "";
    if (!text) {
      return Response.json({ error: "Comment body is required" }, { status: 400 });
    }
    if (text.length > MAX_COMMENT_LENGTH) {
      return Response.json(
        { error: `Comment must be ${MAX_COMMENT_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const page = await query<{ id: string }>(`SELECT id FROM wiki_pages WHERE id = $1`, [id]);
    if (page.rows.length === 0) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    const inserted = await query<{
      id: string;
      page_id: string;
      author_id: string | null;
      body: string;
      created_at: Date;
    }>(
      `INSERT INTO wiki_comments (page_id, author_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, page_id, author_id, body, created_at`,
      [id, guard.user.id, text]
    );

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "comment.created",
      target: `comment:${inserted.rows[0].id}`,
      diff: { pageId: id, length: text.length },
    });

    const row = inserted.rows[0];
    return Response.json(
      {
        comment: {
          id: row.id,
          pageId: row.page_id,
          authorId: row.author_id,
          // The session's own name — authoritative here, and cheaper than a join.
          authorName: guard.user.name,
          body: row.body,
          createdAt: new Date(row.created_at).toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("create wiki comment failed:", error);
    return Response.json({ error: "Failed to create comment" }, { status: 500 });
  }
}

/** GET is the thread's refresh path after a post/delete. */
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
    const page = await query<{ id: string }>(`SELECT id FROM wiki_pages WHERE id = $1`, [id]);
    if (page.rows.length === 0) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }
    return Response.json({ comments: await listPageComments(id) });
  } catch (error) {
    console.error("list wiki comments failed:", error);
    return Response.json({ error: "Failed to list comments" }, { status: 500 });
  }
}

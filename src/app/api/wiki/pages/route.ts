import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import {
  getWikiPageDetail,
  listWikiPages,
  parseLabelIds,
  writeWikiAudit,
} from "@/lib/wiki";

/** Max page-title length. Longer titles are a 400, not a silent truncation. */
export const MAX_TITLE_LENGTH = 200;

/**
 * GET /api/wiki/pages — the flat page list /wiki renders, newest first.
 * Filtering (title search, label) happens client-side on the same payload:
 * the plan scopes this initiative to a flat list, not a query language.
 */
export async function GET() {
  try {
    const guard = await requirePermission("wiki.view");
    if (!guard.ok) return guard.response;

    return Response.json({ pages: await listWikiPages() });
  } catch (error) {
    console.error("list wiki pages failed:", error);
    return Response.json({ error: "Failed to list wiki pages" }, { status: 500 });
  }
}

/**
 * POST /api/wiki/pages — create an empty page (title + optional labels) and
 * route the client straight into the editor. Content arrives later via PATCH,
 * which keeps the create contract tiny and the title validation honest.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission("wiki.create");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const rawTitle = (body ?? {}) as { title?: unknown };
    const title = typeof rawTitle.title === "string" ? rawTitle.title.trim() : "";
    if (!title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }
    if (title.length > MAX_TITLE_LENGTH) {
      return Response.json(
        { error: `Title must be ${MAX_TITLE_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }

    const labelIds = parseLabelIds(body) ?? [];
    // Validate before writing anything: a 400 must never leave a page behind.
    const invalidLabelIds = await filterUnknownLabelIds(labelIds);
    if (invalidLabelIds.length > 0) {
      return Response.json(
        { error: "Unknown label ids", invalidLabelIds },
        { status: 400 }
      );
    }

    const created = await query<{ id: string }>(
      `INSERT INTO wiki_pages (title, created_by, updated_by)
       VALUES ($1, $2, $2)
       RETURNING id`,
      [title, guard.user.id]
    );
    const pageId = created.rows[0].id;
    if (labelIds.length > 0) {
      await query(
        `INSERT INTO wiki_page_labels (page_id, label_id)
         SELECT $1, unnest($2::uuid[])
         ON CONFLICT DO NOTHING`,
        [pageId, [...new Set(labelIds)]]
      );
    }

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "page.created",
      target: `page:${pageId}`,
      diff: { title, labels: labelIds.length },
    });

    const page = await getWikiPageDetail(pageId);
    return Response.json({ page }, { status: 201 });
  } catch (error) {
    console.error("create wiki page failed:", error);
    return Response.json({ error: "Failed to create wiki page" }, { status: 500 });
  }
}

/** The subset of `ids` that names no wiki_labels row. */
async function filterUnknownLabelIds(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const result = await query<{ id: string }>(
    `SELECT id FROM wiki_labels WHERE id = ANY($1::uuid[])`,
    [[...new Set(ids)]]
  );
  const known = new Set(result.rows.map((row) => row.id));
  return [...new Set(ids)].filter((id) => !known.has(id));
}

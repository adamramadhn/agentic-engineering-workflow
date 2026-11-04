/**
 * The wiki resource's shared mapping + audit layer — the counterpart of
 * `./roles.ts` for pages, labels, comments and attachments. `./permissions`
 * owns authorization; this file owns the wiki tables' shape at the API boundary
 * and the one audit write every wiki/storage mutation makes.
 *
 * Content is tiptap/ProseMirror JSON, stored as JSONB and typed `unknown`
 * end-to-end on purpose: the server never interprets the document, it only
 * checks that it IS an object before storing it. Rendering happens client-side
 * in a read-only editor instance (never `dangerouslySetInnerHTML`).
 */
import { query } from "./db";

// --- rows -------------------------------------------------------------------

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route params arrive as raw strings. A non-UUID would make pg raise
 * `invalid input syntax for type uuid` (→ 500) on the first comparison, so
 * callers check this first and answer 404 — an id that cannot name a row is
 * indistinguishable from one that doesn't.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface WikiLabelRow {
  id: string;
  name: string;
  created_at: Date;
}

export interface WikiLabelResponse {
  id: string;
  name: string;
  createdAt: string;
}

/** The shape embedded in a page's `labels` — no createdAt, the list already
 *  sorts them and nothing renders it there. */
export interface WikiLabelRef {
  id: string;
  name: string;
}

export function toLabelResponse(row: WikiLabelRow): WikiLabelResponse {
  return { id: row.id, name: row.name, createdAt: new Date(row.created_at).toISOString() };
}

/** Label names are trimmed, inner whitespace collapsed, and capped at 60 chars. */
export function normalizeLabelName(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 60);
}

export interface WikiPageRow {
  id: string;
  title: string;
  content: unknown;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  author_name: string | null;
  updated_by_name: string | null;
  comment_count: number;
  labels: unknown;
}

export interface WikiPageSummary {
  id: string;
  title: string;
  labels: WikiLabelRef[];
  authorName: string | null;
  updatedByName: string | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WikiPageDetail extends WikiPageSummary {
  /** tiptap JSON, or null while the page has never been saved with content. */
  content: unknown;
  comments: WikiCommentResponse[];
  attachments: WikiAttachmentResponse[];
}

function toLabels(value: unknown): WikiLabelRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is WikiLabelRef =>
      Boolean(entry) &&
      typeof (entry as { id?: unknown }).id === "string" &&
      typeof (entry as { name?: unknown }).name === "string"
  );
}

/** Row → the list-page shape (no content, no comments, no attachments). */
export function toPageSummary(row: WikiPageRow): WikiPageSummary {
  return {
    id: row.id,
    title: row.title,
    labels: toLabels(row.labels),
    authorName: row.author_name,
    updatedByName: row.updated_by_name,
    commentCount: Number(row.comment_count ?? 0),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export interface WikiCommentRow {
  id: string;
  page_id: string;
  author_id: string | null;
  author_name: string | null;
  body: string;
  created_at: Date;
}

export interface WikiCommentResponse {
  id: string;
  pageId: string;
  authorId: string | null;
  authorName: string | null;
  body: string;
  createdAt: string;
}

export function toCommentResponse(row: WikiCommentRow): WikiCommentResponse {
  return {
    id: row.id,
    pageId: row.page_id,
    authorId: row.author_id,
    authorName: row.author_name,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export interface WikiAttachmentRow {
  id: string;
  page_id: string;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  file_name: string;
  mime_type: string;
  size_bytes: string | number;
  s3_key: string;
  visibility: "public" | "private";
  created_at: Date;
}

export interface WikiAttachmentResponse {
  id: string;
  pageId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: "public" | "private";
  /** The only URL the client ever sees — permission-checked, never raw S3. */
  url: string;
  uploadedByName: string | null;
  createdAt: string;
}

export function toAttachmentResponse(row: WikiAttachmentRow): WikiAttachmentResponse {
  return {
    id: row.id,
    pageId: row.page_id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes ?? 0),
    visibility: row.visibility,
    url: `/api/wiki/files/${row.id}`,
    uploadedByName: row.uploaded_by_name,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// --- queries ----------------------------------------------------------------

const PAGE_SELECT = `
  SELECT p.id, p.title, p.content, p.created_by, p.updated_by, p.created_at, p.updated_at,
         au.name AS author_name, uu.name AS updated_by_name,
         (SELECT COUNT(*)::int FROM wiki_comments c WHERE c.page_id = p.id) AS comment_count,
         COALESCE(
           jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) ORDER BY l.name)
             FILTER (WHERE l.id IS NOT NULL), '[]'::jsonb
         ) AS labels
  FROM wiki_pages p
  LEFT JOIN users au ON au.id = p.created_by
  LEFT JOIN users uu ON uu.id = p.updated_by
  LEFT JOIN wiki_page_labels pl ON pl.page_id = p.id
  LEFT JOIN wiki_labels l ON l.id = pl.label_id`;

/** Every page, newest-first — the flat list /wiki renders. */
export async function listWikiPages(): Promise<WikiPageSummary[]> {
  const result = await query<WikiPageRow>(
    `${PAGE_SELECT}
     GROUP BY p.id, au.name, uu.name
     ORDER BY p.updated_at DESC, p.id ASC`
  );
  return result.rows.map(toPageSummary);
}

export async function getWikiPageRow(id: string): Promise<WikiPageRow | null> {
  const result = await query<WikiPageRow>(
    `${PAGE_SELECT}
     WHERE p.id = $1
     GROUP BY p.id, au.name, uu.name`,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listWikiLabels(): Promise<WikiLabelResponse[]> {
  const result = await query<WikiLabelRow>(
    `SELECT id, name, created_at FROM wiki_labels ORDER BY name ASC`
  );
  return result.rows.map(toLabelResponse);
}

export async function listPageComments(pageId: string): Promise<WikiCommentResponse[]> {
  const result = await query<WikiCommentRow>(
    `SELECT c.id, c.page_id, c.author_id, u.name AS author_name, c.body, c.created_at
     FROM wiki_comments c
     LEFT JOIN users u ON u.id = c.author_id
     WHERE c.page_id = $1
     ORDER BY c.created_at ASC, c.id ASC`,
    [pageId]
  );
  return result.rows.map(toCommentResponse);
}

export async function listPageAttachments(pageId: string): Promise<WikiAttachmentResponse[]> {
  const result = await query<WikiAttachmentRow>(
    `SELECT a.id, a.page_id, a.uploaded_by, u.name AS uploaded_by_name,
            a.file_name, a.mime_type, a.size_bytes, a.s3_key, a.visibility, a.created_at
     FROM wiki_attachments a
     LEFT JOIN users u ON u.id = a.uploaded_by
     WHERE a.page_id = $1
     ORDER BY a.created_at ASC, a.id ASC`,
    [pageId]
  );
  return result.rows.map(toAttachmentResponse);
}

/** Row + children in three queries — the detail page's whole payload. */
export async function getWikiPageDetail(id: string): Promise<WikiPageDetail | null> {
  const row = await getWikiPageRow(id);
  if (!row) return null;
  const [comments, attachments] = await Promise.all([
    listPageComments(id),
    listPageAttachments(id),
  ]);
  return { ...toPageSummary(row), content: row.content ?? null, comments, attachments };
}

/**
 * Replace a page's label set. Called inside the same request as the page
 * UPDATE so a save is one observable mutation, not two.
 */
export async function replacePageLabels(
  pageId: string,
  labelIds: readonly string[]
): Promise<void> {
  // Deduplicate client-side; the PK would reject a repeat anyway.
  const ids = [...new Set(labelIds)];
  await query(`DELETE FROM wiki_page_labels WHERE page_id = $1`, [pageId]);
  if (ids.length > 0) {
    await query(
      `INSERT INTO wiki_page_labels (page_id, label_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [pageId, ids]
    );
  }
}

// --- audit ------------------------------------------------------------------

/** Every action the wiki/storage API writes to wiki_audit. */
export type WikiAuditAction =
  | "page.created"
  | "page.updated"
  | "page.deleted"
  | "comment.created"
  | "comment.deleted"
  | "label.created"
  | "label.updated"
  | "label.deleted"
  | "attachment.created"
  | "storage.settings.updated";

export interface WikiAuditEntry {
  actorId: string;
  action: WikiAuditAction;
  /** Stable subject id, e.g. `page:<uuid>` or `storage:settings`. */
  target: string;
  diff: unknown;
}

/** Audit after the mutation, sequential but non-fatal — same contract as
 *  writeRoleAudit: a failed write is logged and swallowed, the caller still
 *  returns success. `target` is a raw string, not an FK, so the row outlives
 *  whatever it describes. */
export async function writeWikiAudit(entry: WikiAuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO wiki_audit (actor_id, action, target, diff)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [entry.actorId, entry.action, entry.target, JSON.stringify(entry.diff)]
    );
  } catch (error) {
    console.error("wiki audit write failed:", error);
  }
}

/** A body's `labelIds` (or `labels`) field → string[] | null (null = absent). */
export function parseLabelIds(body: unknown): string[] | null {
  const raw = (body ?? {}) as { labelIds?: unknown; labels?: unknown };
  const candidate = Array.isArray(raw.labelIds)
    ? raw.labelIds
    : Array.isArray(raw.labels)
      ? raw.labels
      : null;
  if (candidate === null) return null;
  return candidate.filter((entry): entry is string => typeof entry === "string");
}

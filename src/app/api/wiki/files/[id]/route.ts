import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import {
  isConfigured,
  presignGetUrl,
  publicObjectUrl,
  readStorageSettings,
} from "@/lib/storage";
import { isUuid } from "@/lib/wiki";

/** How long a private object's presigned URL stays valid. */
const PRESIGN_TTL_MS = 300_000;

/**
 * GET /api/wiki/files/[id] — the ONLY URL any wiki image or file ever uses.
 *
 * Content references this path, never a raw S3 URL, so every byte served is
 * preceded by a `wiki.view` check. Private objects 302 to a short-lived
 * presigned URL (fresh per request, so a leaked URL dies in minutes); public
 * objects 302 to the configured public base. A plain redirect also keeps the
 * browser on `<img src>` — no `next/image` remotePatterns, no presigned-query
 * 400s.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermission("wiki.view");
    if (!guard.ok) return guard.response;

    const { id } = await params;
    if (!isUuid(id)) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const found = await query<{ s3_key: string; visibility: "public" | "private" }>(
      `SELECT s3_key, visibility FROM wiki_attachments WHERE id = $1`,
      [id]
    );
    const attachment = found.rows[0];
    if (!attachment) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    const settings = await readStorageSettings();
    if (!settings || !isConfigured(settings)) {
      return Response.json(
        { error: "Storage is not configured" },
        { status: 503 }
      );
    }

    const target =
      attachment.visibility === "public" && settings.publicBaseUrl
        ? publicObjectUrl(settings, attachment.s3_key)
        : await presignGetUrl(settings, attachment.s3_key, PRESIGN_TTL_MS);

    return Response.redirect(target, 302);
  } catch (error) {
    console.error("serve wiki file failed:", error);
    return Response.json({ error: "Failed to serve file" }, { status: 500 });
  }
}

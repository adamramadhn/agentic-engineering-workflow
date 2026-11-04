import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import {
  buildObjectKey,
  isConfigured,
  putObject,
  readStorageSettings,
} from "@/lib/storage";
import { isUuid, writeWikiAudit } from "@/lib/wiki";

/**
 * POST /api/wiki/attachments — the one wiki endpoint that speaks formData
 * instead of JSON.
 *
 * It must be a route handler, never a server action: server actions cap
 * request bodies at 1 MB. The app itself caps uploads at MAX_UPLOAD_MB_CEILING
 * (10 MB) via the file.size check below — which is exactly why `maxUploadMb`
 * cannot be tuned above 10.
 */

/** MIME types a team page may legitimately embed or attach. */
const ALLOWED_MIME_PREFIXES = ["image/", "text/", "audio/", "video/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/gzip",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/octet-stream",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function isAllowedMime(mime: string): boolean {
  const normalized = mime.toLowerCase().split(";")[0].trim();
  if (!normalized) return false;
  return (
    ALLOWED_MIME_EXACT.has(normalized) ||
    ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  );
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission("wiki.update");
    if (!guard.ok) return guard.response;

    // A malformed multipart body rejects here (TypeError), which is a 400.
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const file = formData.get("file");
    const pageIdField = formData.get("pageId");
    const visibilityField = formData.get("visibility");

    if (!(file instanceof File)) {
      return Response.json({ error: "A file is required" }, { status: 400 });
    }
    const pageId = typeof pageIdField === "string" ? pageIdField : "";
    if (!isUuid(pageId)) {
      return Response.json({ error: "A valid pageId is required" }, { status: 400 });
    }
    // Absent visibility means private — the safe default for a team wiki.
    let visibility: "public" | "private" = "private";
    if (visibilityField !== null && visibilityField !== undefined && visibilityField !== "") {
      if (visibilityField !== "public" && visibilityField !== "private") {
        return Response.json(
          { error: "Visibility must be 'public' or 'private'" },
          { status: 400 }
        );
      }
      visibility = visibilityField;
    }
    if (!isAllowedMime(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type || "unknown"}` },
        { status: 400 }
      );
    }

    const page = await query<{ id: string }>(`SELECT id FROM wiki_pages WHERE id = $1`, [pageId]);
    if (page.rows.length === 0) {
      return Response.json({ error: "Page not found" }, { status: 404 });
    }

    // Storage must be configured before the size check so the UI's hint and the
    // API's 503 agree on the same reason: there is nowhere to put the bytes.
    const settings = await readStorageSettings();
    if (!settings || !isConfigured(settings)) {
      return Response.json(
        { error: "Storage is not configured — an administrator must set it up on /storage first" },
        { status: 503 }
      );
    }

    const maxBytes = settings.maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return Response.json(
        {
          error: `File is ${formatMb(file.size)} MB — the limit is ${settings.maxUploadMb} MB`,
          maxUploadMb: settings.maxUploadMb,
        },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return Response.json({ error: "File is empty" }, { status: 400 });
    }

    const prefix =
      visibility === "public" ? settings.publicPrefix : settings.privatePrefix;
    const key = buildObjectKey(prefix, pageId, file.name);

    // Buffer the whole object: it is ≤10 MB by construction, and PutObject with
    // a stream would need a known length the browser does not guarantee.
    await putObject(settings, key, new Uint8Array(await file.arrayBuffer()), file.type);

    const inserted = await query<{
      id: string;
      page_id: string;
      file_name: string;
      mime_type: string;
      size_bytes: string | number;
      visibility: "public" | "private";
      created_at: Date;
    }>(
      `INSERT INTO wiki_attachments
         (page_id, uploaded_by, file_name, mime_type, size_bytes, s3_key, visibility)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, page_id, file_name, mime_type, size_bytes, visibility, created_at`,
      [pageId, guard.user.id, file.name, file.type, file.size, key, visibility]
    );

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "attachment.created",
      target: `attachment:${inserted.rows[0].id}`,
      diff: { pageId, fileName: file.name, sizeBytes: file.size, visibility },
    });

    const row = inserted.rows[0];
    return Response.json(
      {
        attachment: {
          id: row.id,
          pageId: row.page_id,
          fileName: row.file_name,
          mimeType: row.mime_type,
          sizeBytes: Number(row.size_bytes),
          visibility: row.visibility,
          url: `/api/wiki/files/${row.id}`,
          uploadedByName: guard.user.name,
          createdAt: new Date(row.created_at).toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("upload wiki attachment failed:", error);
    return Response.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

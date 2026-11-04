import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permission-guard";
import {
  isConfigured,
  parseStorageSettings,
  readStorageSettings,
  testConnection,
} from "@/lib/storage";

/**
 * The /storage "Test connection" button. Runs HeadBucket against the settings
 * in the request body when they are complete (so an admin can test BEFORE
 * saving), otherwise against the stored row.
 *
 * A read, not a mutation: it writes no audit row. Unconfigured storage is a
 * 503 — the same contract the upload route uses — because the honest answer to
 * "can we reach S3?" is "there is nothing configured to reach".
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission("storage.manage");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const stored = await readStorageSettings();
    const { settings } = parseStorageSettings(body, stored);

    // The body wins when it is complete (an admin testing an UNSAVED draft —
    // the draft must include the secret, since an unsent secret cannot be
    // merged from anywhere). Any partial body falls back to the stored row:
    // the masked form round-trips without the secret, so "test what is saved"
    // must not require re-typing it.
    const target = isConfigured(settings) ? settings : stored;
    if (!target || !isConfigured(target)) {
      return Response.json(
        { error: "Storage is not configured — save endpoint, region, bucket and credentials first" },
        { status: 503 }
      );
    }

    const result = await testConnection(target);
    if (!result.ok) {
      // The settings are present but S3 refused: the caller's configuration
      // problem, not a server fault — 400 with the SDK's own message.
      return Response.json({ ok: false, error: result.error }, { status: 400 });
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("storage connection test failed:", error);
    return Response.json({ error: "Failed to test storage connection" }, { status: 500 });
  }
}

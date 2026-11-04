import { NextRequest } from "next/server";
import { requirePermission } from "@/lib/permission-guard";
import {
  parseStorageSettings,
  readStorageSettings,
  readStorageView,
  saveStorageSettings,
  toStorageView,
} from "@/lib/storage";
import { writeWikiAudit } from "@/lib/wiki";

/**
 * The admin storage config API. GET answers the masked shape only — the
 * secret never leaves the server. PUT merges: an omitted secret keeps the
 * stored one, so the masked form can round-trip without ever echoing it.
 */

export async function GET() {
  try {
    const guard = await requirePermission("storage.view");
    if (!guard.ok) return guard.response;

    const view = await readStorageView();
    // `null` (never configured) is still a 200: the form needs to render with
    // empty defaults and the UI needs the "unconfigured" state to disable
    // uploads. The shape is identical either way; `configured` decides.
    return Response.json({ settings: view, configured: view?.configured ?? false });
  } catch (error) {
    console.error("read storage settings failed:", error);
    return Response.json({ error: "Failed to read storage settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requirePermission("storage.manage");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const previous = await readStorageSettings();
    const { settings, errors } = parseStorageSettings(body, previous);
    if (Object.keys(errors).length > 0) {
      return Response.json({ error: "Invalid storage settings", errors }, { status: 400 });
    }

    await saveStorageSettings(settings, guard.user.id);

    await writeWikiAudit({
      actorId: guard.user.id,
      action: "storage.settings.updated",
      target: "storage:settings",
      // No secret, ever — not even in the audit trail.
      diff: {
        endpoint: settings.endpoint,
        region: settings.region,
        bucket: settings.bucket,
        publicBaseUrl: settings.publicBaseUrl,
        publicPrefix: settings.publicPrefix,
        privatePrefix: settings.privatePrefix,
        maxUploadMb: settings.maxUploadMb,
      },
    });

    return Response.json({ settings: toStorageView(settings) });
  } catch (error) {
    console.error("save storage settings failed:", error);
    return Response.json({ error: "Failed to save storage settings" }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { query } from "@/lib/db";
import { requirePermission } from "@/lib/permission-guard";
import { listWikiLabels, normalizeLabelName, writeWikiAudit } from "@/lib/wiki";

/**
 * Labels are the wiki's only organizing axis (the plan rules out spaces and
 * trees), so their taxonomy is a wiki-content concern and mutates under
 * `wiki.update` — the same verb that assigns them to pages.
 */

export async function GET() {
  try {
    const guard = await requirePermission("wiki.view");
    if (!guard.ok) return guard.response;

    return Response.json({ labels: await listWikiLabels() });
  } catch (error) {
    console.error("list wiki labels failed:", error);
    return Response.json({ error: "Failed to list labels" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission("wiki.update");
    if (!guard.ok) return guard.response;

    const body = await request.json().catch(() => null);
    const raw = (body ?? {}) as { name?: unknown };
    const name = typeof raw.name === "string" ? normalizeLabelName(raw.name) : "";
    if (!name) {
      return Response.json({ error: "Label name is required" }, { status: 400 });
    }

    try {
      const created = await query<{ id: string; name: string; created_at: Date }>(
        `INSERT INTO wiki_labels (name) VALUES ($1) RETURNING id, name, created_at`,
        [name]
      );
      const row = created.rows[0];
      await writeWikiAudit({
        actorId: guard.user.id,
        action: "label.created",
        target: `label:${row.id}`,
        diff: { name },
      });
      return Response.json(
        { label: { id: row.id, name: row.name, createdAt: new Date(row.created_at).toISOString() } },
        { status: 201 }
      );
    } catch (error) {
      // wiki_labels.name is UNIQUE — the only constraint that can fire here.
      if (isUniqueViolation(error)) {
        return Response.json({ error: "A label with that name already exists" }, { status: 409 });
      }
      throw error;
    }
  } catch (error) {
    console.error("create wiki label failed:", error);
    return Response.json({ error: "Failed to create label" }, { status: 500 });
  }
}

/** pg error code 23505 — unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  return Boolean(error) && (error as { code?: string }).code === "23505";
}

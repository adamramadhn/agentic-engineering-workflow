import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  api,
  apiForm,
  cleanupWikiFixtures,
  clearStorageSettings,
  closeDbPool,
  FIXTURE_EMAILS,
  FIXTURE_PASSWORD,
  getPool,
  login,
  seedFixtureUsers,
  storedStorageSettings,
  userIdByEmail,
  wikiAuditCount,
  wikiAuditRows,
  type ApiResult,
} from "./helpers";

/**
 * The wiki + storage initiative's per-role matrix (the RBAC epic's wiki
 * follow-up) — same shape as matrix.spec.ts: every new route × role over real
 * HTTP, the 401 row set unauthenticated, and the pinned failure modes the
 * endpoint inventory records.
 *
 * Two invariants get their own dedicated proof:
 *
 *   - the masked-secret invariant — GET /api/storage/settings may never
 *     serialize `secretAccessKey`, not in the field, not anywhere in the body
 *     (while the stored JSONB row still holds the plaintext — the accepted
 *     tradeoff, asserted from the DB side);
 *   - no S3 in CI — the scratch run has no bucket, so the unconfigured paths
 *     (upload 503, connection test 503) are asserted as-is, and the "storage
 *     configured" phase points at a non-routable endpoint: presigning is
 *     offline, so the 302s are provable without ever reaching S3.
 *
 * Seed grants decide the rows: Admin ["*"]; Editor wiki.view/create/update/
 * comment (NOT wiki.delete, NOT storage.*); Member wiki.view only. Two more
 * roles are created through the API in beforeAll (the sibling matrix.spec.ts
 * pattern): a moderator holding exactly ["wiki.view","wiki.delete"] — no
 * wiki.comment — proving the DELETE-comment entry gate is the read gate, and
 * an outsider holding ["roles.view"] — zero wiki keys — proving every
 * wiki.view-gated read answers 403 per-role.
 */

/** Suite-created fixtures: a delete-without-comment moderator + a wiki-less role. */
const MODERATOR_ROLE_NAME = "Matrix Wiki Moderator";
const MODERATOR_USER_EMAIL = "wiki-moderator@matrix.test";
const OUTSIDER_ROLE_NAME = "Matrix Wiki Outsider";
const OUTSIDER_USER_EMAIL = "wiki-outsider@matrix.test";

type FixtureId = "admin" | "editor" | "member";
const FIXTURE_IDS: readonly FixtureId[] = ["admin", "editor", "member"];

/** Valid, almost certainly nonexistent — 404s must not depend on the DB. */
const GHOST_UUID = "00000000-0000-4000-8000-000000000000";

/** A port nothing listens on — "configured but unreachable", instantly. */
const DEAD_ENDPOINT = "http://127.0.0.1:1";
const SECRET_VALUE = "matrix-wiki-secret-value";

const cookies: Partial<Record<FixtureId, string>> = {};
/** Logins for the two suite-created roles — outside the OPS table on purpose:
 *  their rows live in the gate-specific describes below. */
let moderatorCookie = "";
let outsiderCookie = "";
/** The page hosting the two pg-inserted attachment rows (outlives afterEach). */
let attachmentHostPageId = "";

let counter = 0;
const nextName = (prefix: string): string => `${prefix}-${++counter}`;

/** Create a throwaway page as admin — ops needing a live id get a fresh one so
 *  one fixture's DELETE never breaks the next fixture's target. */
async function newPage(title: string): Promise<string> {
  const created = await api("/api/wiki/pages", {
    method: "POST",
    cookie: cookies.admin,
    body: { title },
  });
  expect(created.status).toBe(201);
  const id = (created.body as { page?: { id?: string } }).page?.id;
  if (!id) throw new Error("page create returned no id");
  return id;
}

async function newLabel(name: string): Promise<string> {
  const created = await api("/api/wiki/labels", {
    method: "POST",
    cookie: cookies.admin,
    body: { name },
  });
  expect(created.status).toBe(201);
  const id = (created.body as { label?: { id?: string } }).label?.id;
  if (!id) throw new Error("label create returned no id");
  return id;
}

interface OpCase {
  id: number;
  label: string;
  guard: string;
  expected: Record<FixtureId, number>;
  run: (fixture: FixtureId, cookie: string) => Promise<ApiResult>;
  checkSuccess?: (response: ApiResult, fixture: FixtureId) => void;
}

const OPS: readonly OpCase[] = [
  {
    id: 1,
    label: "GET /api/wiki/pages (wiki.view)",
    guard: "wiki.view",
    expected: { admin: 200, editor: 200, member: 200 },
    run: (_fixture, cookie) => api("/api/wiki/pages", { cookie }),
    checkSuccess: (response) => {
      expect(Array.isArray((response.body as { pages?: unknown }).pages)).toBe(true);
    },
  },
  {
    id: 2,
    label: "POST /api/wiki/pages (wiki.create)",
    guard: "wiki.create",
    expected: { admin: 201, editor: 201, member: 403 },
    run: (fixture, cookie) =>
      api("/api/wiki/pages", {
        method: "POST",
        cookie,
        body: { title: `Matrix Wiki Op2 ${fixture} ${nextName("n")}` },
      }),
    checkSuccess: (response) => {
      const page = (response.body as { page?: { title?: string; content?: unknown } }).page;
      expect(page?.title).toMatch(/^Matrix Wiki Op2 /);
      // Create answers the detail shape: content null until the first save.
      expect(page?.content).toBeNull();
    },
  },
  {
    id: 3,
    label: "GET /api/wiki/pages/[id] (wiki.view)",
    guard: "wiki.view",
    expected: { admin: 200, editor: 200, member: 200 },
    run: async (_fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op3 ${nextName("n")}`);
      return api(`/api/wiki/pages/${id}`, { cookie });
    },
    checkSuccess: (response) => {
      const page = (response.body as { page?: { comments?: unknown[]; attachments?: unknown[] } })
        .page;
      expect(Array.isArray(page?.comments)).toBe(true);
      expect(Array.isArray(page?.attachments)).toBe(true);
    },
  },
  {
    id: 4,
    label: "PATCH /api/wiki/pages/[id] (wiki.update)",
    guard: "wiki.update",
    expected: { admin: 200, editor: 200, member: 403 },
    run: async (_fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op4 ${nextName("n")}`);
      return api(`/api/wiki/pages/${id}`, {
        method: "PATCH",
        cookie,
        body: {
          content: { type: "doc", content: [{ type: "paragraph" }] },
        },
      });
    },
    checkSuccess: (response) => {
      const page = (response.body as { page?: { content?: { type?: string } } }).page;
      expect(page?.content).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
    },
  },
  {
    id: 5,
    label: "DELETE /api/wiki/pages/[id] (wiki.delete)",
    guard: "wiki.delete",
    expected: { admin: 200, editor: 403, member: 403 },
    run: async (_fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op5 ${nextName("n")}`);
      return api(`/api/wiki/pages/${id}`, { method: "DELETE", cookie });
    },
    checkSuccess: (response) => {
      expect(response.body).toEqual({ deleted: true });
    },
  },
  {
    id: 6,
    label: "POST /api/wiki/pages/[id]/comments (wiki.comment)",
    guard: "wiki.comment",
    expected: { admin: 201, editor: 201, member: 403 },
    run: async (fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op6 ${nextName("n")}`);
      return api(`/api/wiki/pages/${id}/comments`, {
        method: "POST",
        cookie,
        body: { body: `op6 remark from ${fixture}` },
      });
    },
    checkSuccess: (response, fixture) => {
      // Author is the session's, never a body field.
      expect(response.body).toMatchObject({
        comment: {
          body: `op6 remark from ${fixture}`,
          authorName: fixture === "admin" ? "Matrix Admin" : "Matrix Editor",
        },
      });
    },
  },
  {
    id: 7,
    label: "GET /api/wiki/pages/[id]/comments (wiki.view)",
    guard: "wiki.view",
    expected: { admin: 200, editor: 200, member: 200 },
    run: async (_fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op7 ${nextName("n")}`);
      return api(`/api/wiki/pages/${id}/comments`, { cookie });
    },
    checkSuccess: (response) => {
      expect(response.body).toEqual({ comments: [] });
    },
  },
  {
    id: 8,
    label: "GET /api/wiki/labels (wiki.view)",
    guard: "wiki.view",
    expected: { admin: 200, editor: 200, member: 200 },
    run: (_fixture, cookie) => api("/api/wiki/labels", { cookie }),
    checkSuccess: (response) => {
      expect(Array.isArray((response.body as { labels?: unknown }).labels)).toBe(true);
    },
  },
  {
    id: 9,
    label: "POST /api/wiki/labels (wiki.update)",
    guard: "wiki.update",
    expected: { admin: 201, editor: 201, member: 403 },
    run: (fixture, cookie) =>
      api("/api/wiki/labels", {
        method: "POST",
        cookie,
        body: { name: nextName(`matrix-wiki-op9-${fixture}`) },
      }),
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({
        label: { name: expect.stringMatching(/^matrix-wiki-op9-/) },
      });
    },
  },
  {
    id: 10,
    label: "PATCH /api/wiki/labels/[id] (wiki.update)",
    guard: "wiki.update",
    expected: { admin: 200, editor: 200, member: 403 },
    run: async (_fixture, cookie) => {
      const id = await newLabel(nextName("matrix-wiki-op10"));
      return api(`/api/wiki/labels/${id}`, {
        method: "PATCH",
        cookie,
        body: { name: nextName("matrix-wiki-op10-renamed") },
      });
    },
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({
        label: { name: expect.stringMatching(/^matrix-wiki-op10-renamed-/) },
      });
    },
  },
  {
    id: 11,
    label: "DELETE /api/wiki/labels/[id] (wiki.update)",
    guard: "wiki.update",
    expected: { admin: 200, editor: 200, member: 403 },
    run: async (_fixture, cookie) => {
      const id = await newLabel(nextName("matrix-wiki-op11"));
      return api(`/api/wiki/labels/${id}`, { method: "DELETE", cookie });
    },
    checkSuccess: (response) => {
      expect(response.body).toEqual({ deleted: true });
    },
  },
  {
    id: 12,
    label: "GET /api/storage/settings (storage.view)",
    guard: "storage.view",
    expected: { admin: 200, editor: 403, member: 403 },
    run: (_fixture, cookie) => api("/api/storage/settings", { cookie }),
    checkSuccess: (response) => {
      // The matrix phase runs unconfigured: null settings, configured false —
      // still a 200, the /storage form renders empty defaults on it.
      expect(response.body).toEqual({ settings: null, configured: false });
    },
  },
  {
    id: 13,
    label: "POST /api/storage/settings/test (storage.manage)",
    guard: "storage.manage",
    expected: { admin: 503, editor: 403, member: 403 },
    run: (_fixture, cookie) =>
      api("/api/storage/settings/test", { method: "POST", cookie, body: {} }),
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({ error: expect.stringContaining("not configured") });
    },
  },
  {
    id: 14,
    label: "POST /api/wiki/attachments (wiki.update, formData)",
    guard: "wiki.update",
    expected: { admin: 503, editor: 503, member: 403 },
    run: async (_fixture, cookie) => {
      const id = await newPage(`Matrix Wiki Op14 ${nextName("n")}`);
      return apiForm("/api/wiki/attachments", {
        cookie,
        fields: { pageId: id },
        files: {
          file: {
            name: "matrix-wiki.txt",
            type: "text/plain",
            bytes: new TextEncoder().encode("matrix wiki upload"),
          },
        },
      });
    },
    checkSuccess: (response) => {
      expect(response.body).toMatchObject({ error: expect.stringContaining("not configured") });
    },
  },
  {
    id: 15,
    label: "GET /api/wiki/files/[id] (wiki.view)",
    guard: "wiki.view",
    // Every fixture holds wiki.view, so the gate never fires here — the row is
    // the unconfigured 503 for all three (the guard itself is pinned by the
    // 401 set and by the entry-gate design note in the inventory).
    expected: { admin: 503, editor: 503, member: 503 },
    run: (_fixture, cookie) => api(`/api/wiki/files/${attachmentFileId("private")}`, { cookie }),
    checkSuccess: (response) => {
      expect(response.body).toEqual({ error: "Storage is not configured" });
    },
  },
];

// --- pg-side fixtures the HTTP ops read ---------------------------------------

const attachmentIds: Record<"private" | "public", string> = { private: "", public: "" };

function attachmentFileId(visibility: "private" | "public"): string {
  const id = attachmentIds[visibility];
  if (!id) throw new Error(`no ${visibility} attachment fixture`);
  return id;
}

/** Create a role through the API (as admin) and return its derived key. */
async function newRole(name: string, permissions: string[]): Promise<string> {
  const created = await api("/api/roles", {
    method: "POST",
    cookie: cookies.admin,
    body: { name, description: `suite-created fixture: exactly ${permissions.join(", ")}`, permissions },
  });
  expect(created.status).toBe(201);
  const key = (created.body as { role?: { key?: string } }).role?.key;
  if (!key) throw new Error("role create returned no key");
  return key;
}

/** Create the custom role's login through the API (as admin). */
async function newRoleUser(name: string, email: string, roleKey: string): Promise<void> {
  const created = await api("/api/users", {
    method: "POST",
    cookie: cookies.admin,
    body: { name, email, password: FIXTURE_PASSWORD, role: roleKey },
  });
  expect(created.status).toBe(201);
}

beforeAll(async () => {
  await seedFixtureUsers();
  for (const fixture of FIXTURE_IDS) {
    cookies[fixture] = await login(FIXTURE_EMAILS[fixture], FIXTURE_PASSWORD);
  }

  // Constructible-via-/permissions roles, constructed the same way: the
  // moderator is the frozen matrix row's "delete-without-comment" actor; the
  // outsider has no wiki key at all, so every wiki.view read gates them out.
  const moderatorRole = await newRole(MODERATOR_ROLE_NAME, ["wiki.view", "wiki.delete"]);
  await newRoleUser("Matrix Wiki Moderator", MODERATOR_USER_EMAIL, moderatorRole);
  moderatorCookie = await login(MODERATOR_USER_EMAIL, FIXTURE_PASSWORD);
  const outsiderRole = await newRole(OUTSIDER_ROLE_NAME, ["roles.view"]);
  await newRoleUser("Matrix Wiki Outsider", OUTSIDER_USER_EMAIL, outsiderRole);
  outsiderCookie = await login(OUTSIDER_USER_EMAIL, FIXTURE_PASSWORD);

  await clearStorageSettings();

  // The attachment host + two metadata rows. Bytes never enter Postgres — the
  // s3_key just names where they would be; the files route only reads it.
  const host = await getPool().query<{ id: string }>(
    `INSERT INTO wiki_pages (title, created_by) VALUES ('Wiki Matrix Attachment Host', NULL)
     RETURNING id`,
  );
  attachmentHostPageId = host.rows[0].id;
  for (const visibility of ["private", "public"] as const) {
    const inserted = await getPool().query<{ id: string }>(
      `INSERT INTO wiki_attachments
         (page_id, uploaded_by, file_name, mime_type, size_bytes, s3_key, visibility)
       VALUES ($1, NULL, $2, 'text/plain', 24, $3, $4)
       RETURNING id`,
      [
        attachmentHostPageId,
        `host-${visibility}.txt`,
        `wiki-${visibility}/${attachmentHostPageId}/fixture-${visibility}.txt`,
        visibility,
      ],
    );
    attachmentIds[visibility] = inserted.rows[0].id;
  }
});

afterEach(async () => {
  // Ops artifacts only (Matrix Wiki-prefixed pages, matrix-wiki-* labels). The
  // attachment host's title deliberately does NOT match the prefix, so the
  // files-route fixtures survive until afterAll.
  await cleanupWikiFixtures();
});

afterAll(async () => {
  // Attachments cascade with their page; wiki_audit survives by design.
  await getPool().query(`DELETE FROM wiki_pages WHERE id = $1`, [attachmentHostPageId]);
  await cleanupWikiFixtures();
  await clearStorageSettings();
  await closeDbPool();
});

describe("per-role matrix", () => {
  for (const fixture of FIXTURE_IDS) {
    for (const op of OPS) {
      test(`op${op.id} ${op.label} as ${fixture} → ${op.expected[fixture]}`, async () => {
        const cookie = cookies[fixture];
        if (!cookie) throw new Error(`no login cookie for fixture ${fixture}`);
        const response = await op.run(fixture, cookie);
        const expected = op.expected[fixture];
        expect(response.status).toBe(expected);
        if (expected === 403) {
          expect(response.body).toEqual({ error: "Forbidden", requiredPermission: op.guard });
        } else if (op.checkSuccess) {
          await op.checkSuccess(response, fixture);
        }
      });
    }
  }
});

// The 401 row set: every wiki/storage route, unauthenticated, same pinned body.
const UNAUTH_CALLS: ReadonlyArray<[string, () => Promise<ApiResult>]> = [
  ["GET /api/wiki/pages", () => api("/api/wiki/pages")],
  ["POST /api/wiki/pages", () => api("/api/wiki/pages", { method: "POST", body: { title: "X" } })],
  ["GET /api/wiki/pages/[id]", () => api(`/api/wiki/pages/${GHOST_UUID}`)],
  [
    "PATCH /api/wiki/pages/[id]",
    () => api(`/api/wiki/pages/${GHOST_UUID}`, { method: "PATCH", body: { title: "X" } }),
  ],
  ["DELETE /api/wiki/pages/[id]", () => api(`/api/wiki/pages/${GHOST_UUID}`, { method: "DELETE" })],
  [
    "GET /api/wiki/pages/[id]/comments",
    () => api(`/api/wiki/pages/${GHOST_UUID}/comments`),
  ],
  [
    "POST /api/wiki/pages/[id]/comments",
    () => api(`/api/wiki/pages/${GHOST_UUID}/comments`, { method: "POST", body: { body: "x" } }),
  ],
  ["DELETE /api/wiki/comments/[id]", () => api(`/api/wiki/comments/${GHOST_UUID}`, { method: "DELETE" })],
  ["GET /api/wiki/labels", () => api("/api/wiki/labels")],
  ["POST /api/wiki/labels", () => api("/api/wiki/labels", { method: "POST", body: { name: "x" } })],
  [
    "PATCH /api/wiki/labels/[id]",
    () => api(`/api/wiki/labels/${GHOST_UUID}`, { method: "PATCH", body: { name: "x" } }),
  ],
  ["DELETE /api/wiki/labels/[id]", () => api(`/api/wiki/labels/${GHOST_UUID}`, { method: "DELETE" })],
  ["POST /api/wiki/attachments", () => apiForm("/api/wiki/attachments")],
  ["GET /api/wiki/files/[id]", () => api(`/api/wiki/files/${GHOST_UUID}`)],
  ["GET /api/storage/settings", () => api("/api/storage/settings")],
  [
    "PUT /api/storage/settings",
    () => api("/api/storage/settings", { method: "PUT", body: { region: "us-east-1" } }),
  ],
  ["POST /api/storage/settings/test", () => api("/api/storage/settings/test", { method: "POST", body: {} })],
];

describe("unauthenticated 401 row set", () => {
  for (const [label, call] of UNAUTH_CALLS) {
    test(`${label} → 401`, async () => {
      const response = await call();
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: "Not authenticated" });
    });
  }
});

describe("validation: 400s never mutate", () => {
  test("POST page: empty title → 400", async () => {
    const response = await api("/api/wiki/pages", {
      method: "POST",
      cookie: cookies.admin,
      body: { title: "   " },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Title is required" });
  });

  test("POST page: 201-char title → 400", async () => {
    const response = await api("/api/wiki/pages", {
      method: "POST",
      cookie: cookies.admin,
      body: { title: "t".repeat(201) },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Title must be 200 characters or fewer" });
  });

  test("POST page: unknown labelIds → 400 with the offenders, and no page row appears", async () => {
    const before = await getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM wiki_pages`,
    );
    const response = await api("/api/wiki/pages", {
      method: "POST",
      cookie: cookies.admin,
      body: { title: "Matrix Wiki Badlabel", labelIds: [GHOST_UUID] },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "Unknown label ids", invalidLabelIds: [GHOST_UUID] });
    const after = await getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM wiki_pages`,
    );
    expect(after.rows[0].count).toBe(before.rows[0].count);
  });

  test("GET page: a non-uuid id is a 404, never a 500 (pg uuid parse)", async () => {
    const response = await api(`/api/wiki/pages/not-a-uuid`, { cookie: cookies.admin });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "Page not found" });
  });

  test("PATCH and DELETE page on a well-formed but absent uuid → 404 authenticated", async () => {
    // The I/O matrix's Save-content and Delete-page 404 cells, with a session
    // (the 401 row set proves the unauthenticated side).
    const patched = await api(`/api/wiki/pages/${GHOST_UUID}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { title: "Ghost" },
    });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "Page not found" });

    const deleted = await api(`/api/wiki/pages/${GHOST_UUID}`, {
      method: "DELETE",
      cookie: cookies.admin,
    });
    expect(deleted.status).toBe(404);
    expect(deleted.body).toEqual({ error: "Page not found" });
  });

  test("deleting a page cascades its comments, attachment rows and label links (label survives)", async () => {
    // The Delete-page matrix row's cascade claim, asserted against the rows.
    const pageId = await newPage("Matrix Wiki Cascade");
    const labelId = await newLabel(nextName("matrix-wiki-cascade-label"));
    const linked = await api(`/api/wiki/pages/${pageId}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { labelIds: [labelId] },
    });
    expect(linked.status).toBe(200);
    const commented = await api(`/api/wiki/pages/${pageId}/comments`, {
      method: "POST",
      cookie: cookies.editor,
      body: { body: "goes down with the ship" },
    });
    expect(commented.status).toBe(201);
    await getPool().query(
      `INSERT INTO wiki_attachments (page_id, uploaded_by, file_name, mime_type, size_bytes, s3_key, visibility)
       VALUES ($1, NULL, 'cascade.txt', 'text/plain', 4, 'wiki-private/${pageId}/fixture.txt', 'private')`,
      [pageId],
    );

    const deleted = await api(`/api/wiki/pages/${pageId}`, { method: "DELETE", cookie: cookies.admin });
    expect(deleted.status).toBe(200);

    for (const table of ["wiki_comments", "wiki_attachments", "wiki_page_labels"]) {
      const rows = await getPool().query(`SELECT 1 FROM ${table} WHERE page_id = $1`, [pageId]);
      expect(rows.rows).toHaveLength(0);
    }
    // The label itself belongs to the taxonomy, not the page — it survives.
    const label = await getPool().query(`SELECT id FROM wiki_labels WHERE id = $1`, [labelId]);
    expect(label.rows).toHaveLength(1);
  });

  test("PATCH page: content as a string → 400 and the stored document is untouched", async () => {
    const id = await newPage("Matrix Wiki Badcontent");
    const rejected = await api(`/api/wiki/pages/${id}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { content: "<p>not tiptap json</p>" },
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: "Content must be a tiptap JSON object" });
    const after = await api(`/api/wiki/pages/${id}`, { cookie: cookies.admin });
    expect((after.body as { page?: { content?: unknown } }).page?.content).toBeNull();
  });

  test("PATCH page: empty title → 400; unknown labelIds → 400", async () => {
    const id = await newPage("Matrix Wiki Patchcases");
    const emptyTitle = await api(`/api/wiki/pages/${id}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { title: "  " },
    });
    expect(emptyTitle.status).toBe(400);
    expect(emptyTitle.body).toEqual({ error: "Title cannot be empty" });

    const badLabels = await api(`/api/wiki/pages/${id}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { labelIds: [GHOST_UUID] },
    });
    expect(badLabels.status).toBe(400);
    expect(badLabels.body).toEqual({ error: "Unknown label ids", invalidLabelIds: [GHOST_UUID] });
  });

  test("POST comment: empty body → 400, 5001 chars → 400, unknown page → 404", async () => {
    const id = await newPage("Matrix Wiki Commentcases");
    const empty = await api(`/api/wiki/pages/${id}/comments`, {
      method: "POST",
      cookie: cookies.admin,
      body: { body: "   " },
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: "Comment body is required" });

    const tooLong = await api(`/api/wiki/pages/${id}/comments`, {
      method: "POST",
      cookie: cookies.admin,
      body: { body: "c".repeat(5001) },
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ error: "Comment must be 5000 characters or fewer" });

    const ghost = await api(`/api/wiki/pages/${GHOST_UUID}/comments`, {
      method: "POST",
      cookie: cookies.admin,
      body: { body: "where is this page" },
    });
    expect(ghost.status).toBe(404);
  });

  test("labels: empty name → 400, whitespace is normalized, duplicate name → 409", async () => {
    const empty = await api("/api/wiki/labels", {
      method: "POST",
      cookie: cookies.admin,
      body: { name: "   " },
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: "Label name is required" });

    const created = await api("/api/wiki/labels", {
      method: "POST",
      cookie: cookies.admin,
      body: { name: "  matrix-wiki   ops\t\thandbook  " },
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ label: { name: "matrix-wiki ops handbook" } });

    const duplicate = await api("/api/wiki/labels", {
      method: "POST",
      cookie: cookies.admin,
      body: { name: "matrix-wiki ops handbook" },
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toEqual({ error: "A label with that name already exists" });
  });

  test("labels: renaming onto an existing name → 409; unknown uuid → 404", async () => {
    const first = await newLabel(nextName("matrix-wiki-rename-a"));
    const second = await newLabel(nextName("matrix-wiki-rename-b"));
    const rename = await api(`/api/wiki/labels/${second}`, {
      method: "PATCH",
      cookie: cookies.admin,
      // Rename onto first's CURRENT name — the collision is the point.
      body: {
        name: (await wikiLabelName(first)) ?? "unreachable",
      },
    });
    expect(rename.status).toBe(409);

    const ghost = await api(`/api/wiki/labels/${GHOST_UUID}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { name: "matrix-wiki ghost" },
    });
    expect(ghost.status).toBe(404);
  });

  test("upload: missing file → 400, bad mime → 400, bad pageId → 400, bad visibility → 400, unknown page → 404", async () => {
    const id = await newPage("Matrix Wiki Uploadcases");
    const bytes = new TextEncoder().encode("matrix wiki upload");

    const noFile = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId: id },
    });
    expect(noFile.status).toBe(400);
    expect(noFile.body).toEqual({ error: "A file is required" });

    const badMime = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId: id },
      files: { file: { name: "matrix.exe", type: "application/x-msdownload", bytes } },
    });
    expect(badMime.status).toBe(400);
    expect(badMime.body).toEqual({ error: "Unsupported file type: application/x-msdownload" });

    const badPage = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId: "not-a-uuid" },
      files: { file: { name: "matrix-wiki.txt", type: "text/plain", bytes } },
    });
    expect(badPage.status).toBe(400);
    expect(badPage.body).toEqual({ error: "A valid pageId is required" });

    const badVisibility = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId: id, visibility: "secret" },
      files: { file: { name: "matrix-wiki.txt", type: "text/plain", bytes } },
    });
    expect(badVisibility.status).toBe(400);
    expect(badVisibility.body).toEqual({ error: "Visibility must be 'public' or 'private'" });

    const ghostPage = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId: GHOST_UUID },
      files: { file: { name: "matrix-wiki.txt", type: "text/plain", bytes } },
    });
    expect(ghostPage.status).toBe(404);
    expect(ghostPage.body).toEqual({ error: "Page not found" });
  });

  test("files: a non-uuid id is a 404, never a 500", async () => {
    const response = await api(`/api/wiki/files/not-a-uuid`, { cookie: cookies.admin });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "File not found" });
  });
});

async function wikiLabelName(id: string): Promise<string | null> {
  const result = await getPool().query<{ name: string }>(
    `SELECT name FROM wiki_labels WHERE id = $1`,
    [id],
  );
  return result.rows[0]?.name ?? null;
}

describe("comment deletion: author vs moderator", () => {
  test("the author may retract their own words; wiki.delete may moderate; neither else", async () => {
    const pageId = await newPage("Matrix Wiki Commentrules");
    const post = async (fixture: FixtureId, body: string): Promise<string> => {
      const created = await api(`/api/wiki/pages/${pageId}/comments`, {
        method: "POST",
        cookie: cookies[fixture],
        body: { body },
      });
      expect(created.status).toBe(201);
      const id = (created.body as { comment?: { id?: string } }).comment?.id;
      if (!id) throw new Error("comment create returned no id");
      return id;
    };

    const adminComment = await post("admin", "admin speaks");
    const editorComment = await post("editor", "editor speaks, admin moderates this one");
    const editorSecond = await post("editor", "editor retracts this one");

    // Member passes the wiki.view ENTRY gate but holds neither delete branch:
    // the 403 is the author-or-wiki.delete rule, not the entry gate.
    const asMember = await api(`/api/wiki/comments/${editorComment}`, {
      method: "DELETE",
      cookie: cookies.member,
    });
    expect(asMember.status).toBe(403);
    expect(asMember.body).toEqual({ error: "Forbidden", requiredPermission: "wiki.delete" });

    // Editor can speak but not moderate: someone else's comment needs wiki.delete.
    const editorOnAdmin = await api(`/api/wiki/comments/${adminComment}`, {
      method: "DELETE",
      cookie: cookies.editor,
    });
    expect(editorOnAdmin.status).toBe(403);
    expect(editorOnAdmin.body).toEqual({ error: "Forbidden", requiredPermission: "wiki.delete" });
    // The row survived the refused delete.
    expect(await commentExists(adminComment)).toBe(true);

    // Admin moderates the EDITOR's comment as a non-author.
    const adminOnEditor = await api(`/api/wiki/comments/${editorComment}`, {
      method: "DELETE",
      cookie: cookies.admin,
    });
    expect(adminOnEditor.body).toEqual({ deleted: true });

    // The moderator role holds wiki.delete WITHOUT wiki.comment (constructible
    // via /permissions) — the wiki.view entry gate must not lock it out of
    // moderating a foreign comment.
    const adminComment2 = await post("admin", "moderator removes this one");
    const moderatorOnAdmin = await api(`/api/wiki/comments/${adminComment2}`, {
      method: "DELETE",
      cookie: moderatorCookie,
    });
    expect(moderatorOnAdmin.status).toBe(200);
    expect(moderatorOnAdmin.body).toEqual({ deleted: true });

    // The author retracts their own — allowed without wiki.delete.
    const editorOnOwn = await api(`/api/wiki/comments/${editorSecond}`, {
      method: "DELETE",
      cookie: cookies.editor,
    });
    expect(editorOnOwn.body).toEqual({ deleted: true });
    expect(await commentExists(editorSecond)).toBe(false);

    // Audit distinguishes the two paths by asAuthor.
    const moderation = await wikiAuditRows(`comment:${editorComment}`, "comment.deleted");
    expect(moderation).toHaveLength(1);
    expect(moderation[0].actor_id).toBe(await userIdByEmail(FIXTURE_EMAILS.admin));
    expect(moderation[0].diff).toEqual({ pageId, asAuthor: false });
    const retraction = await wikiAuditRows(`comment:${editorSecond}`, "comment.deleted");
    expect(retraction).toHaveLength(1);
    expect(retraction[0].actor_id).toBe(await userIdByEmail(FIXTURE_EMAILS.editor));
    expect(retraction[0].diff).toEqual({ pageId, asAuthor: true });
    // The comment-less moderator's delete audited like any moderation.
    const foreignModeration = await wikiAuditRows(`comment:${adminComment2}`, "comment.deleted");
    expect(foreignModeration).toHaveLength(1);
    expect(foreignModeration[0].actor_id).toBe(await userIdByEmail(MODERATOR_USER_EMAIL));
    expect(foreignModeration[0].diff).toEqual({ pageId, asAuthor: false });
  });
});

async function commentExists(id: string): Promise<boolean> {
  const result = await getPool().query(`SELECT id FROM wiki_comments WHERE id = $1`, [id]);
  return result.rows.length > 0;
}

describe("wiki.view entry gate: a role with no wiki key reads nothing", () => {
  // The seeded fixtures all hold wiki.view, so the five read ops never gate
  // per-role in the OPS table — the outsider (exactly ["roles.view"], built in
  // beforeAll) supplies the 403 rows the plan's matrix demands.
  const READ_CALLS: ReadonlyArray<[string, () => Promise<ApiResult>]> = [
    ["GET /api/wiki/pages", () => api("/api/wiki/pages", { cookie: outsiderCookie })],
    [
      "GET /api/wiki/pages/[id]",
      async () => {
        const id = await newPage("Matrix Wiki Outsider Read");
        return api(`/api/wiki/pages/${id}`, { cookie: outsiderCookie });
      },
    ],
    [
      "GET /api/wiki/pages/[id]/comments",
      async () => {
        const id = await newPage("Matrix Wiki Outsider Comments");
        return api(`/api/wiki/pages/${id}/comments`, { cookie: outsiderCookie });
      },
    ],
    ["GET /api/wiki/labels", () => api("/api/wiki/labels", { cookie: outsiderCookie })],
    [
      "GET /api/wiki/files/[id]",
      () => api(`/api/wiki/files/${attachmentFileId("private")}`, { cookie: outsiderCookie }),
    ],
  ];

  for (const [label, call] of READ_CALLS) {
    test(`${label} as wiki-less outsider → 403`, async () => {
      const response = await call();
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: "Forbidden", requiredPermission: "wiki.view" });
    });
  }
});

describe("wiki audit: every mutation writes its row", () => {
  test("page create + update + delete each audit, with the actor's id", async () => {
    const adminId = await userIdByEmail(FIXTURE_EMAILS.admin);
    const editorId = await userIdByEmail(FIXTURE_EMAILS.editor);

    const created = await api("/api/wiki/pages", {
      method: "POST",
      cookie: cookies.admin,
      body: { title: "Matrix Wiki Audit" },
    });
    const id = (created.body as { page?: { id?: string } }).page?.id;
    expect(id).toBeTruthy();
    const target = `page:${id}`;

    const createdRows = await wikiAuditRows(target, "page.created");
    expect(createdRows).toHaveLength(1);
    expect(createdRows[0].actor_id).toBe(adminId);
    expect(createdRows[0].diff).toEqual({ title: "Matrix Wiki Audit", labels: 0 });

    // A different actor saves the document — the audit names them.
    const saved = await api(`/api/wiki/pages/${id}`, {
      method: "PATCH",
      cookie: cookies.editor,
      body: { content: { type: "doc", content: [] } },
    });
    expect(saved.status).toBe(200);
    const updatedRows = await wikiAuditRows(target, "page.updated");
    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0].actor_id).toBe(editorId);
    expect(updatedRows[0].diff).toEqual({
      title: "Matrix Wiki Audit",
      contentSaved: true,
      labels: undefined,
    });

    const deleted = await api(`/api/wiki/pages/${id}`, { method: "DELETE", cookie: cookies.admin });
    expect(deleted.status).toBe(200);
    const deletedRows = await wikiAuditRows(target, "page.deleted");
    expect(deletedRows).toHaveLength(1);
    expect(deletedRows[0].diff).toEqual({ title: "Matrix Wiki Audit", attachments: 0 });

    // Three rows total for the page's life, in order.
    expect((await wikiAuditRows(target)).map((row) => row.action)).toEqual([
      "page.created",
      "page.updated",
      "page.deleted",
    ]);
  });

  test("label create/rename/delete audit under their own uuid targets", async () => {
    const created = await api("/api/wiki/labels", {
      method: "POST",
      cookie: cookies.admin,
      body: { name: nextName("matrix-wiki-audit-label") },
    });
    const id = (created.body as { label?: { id?: string } }).label?.id;
    expect(id).toBeTruthy();

    expect(await wikiAuditCount(`label:${id}`, "label.created")).toBe(1);

    const renamed = await api(`/api/wiki/labels/${id}`, {
      method: "PATCH",
      cookie: cookies.admin,
      body: { name: nextName("matrix-wiki-audit-label-renamed") },
    });
    expect(renamed.status).toBe(200);
    expect(await wikiAuditCount(`label:${id}`, "label.updated")).toBe(1);

    const removed = await api(`/api/wiki/labels/${id}`, {
      method: "DELETE",
      cookie: cookies.admin,
    });
    expect(removed.status).toBe(200);
    expect(await wikiAuditCount(`label:${id}`, "label.deleted")).toBe(1);
  });
});

describe("storage settings: write-only secret, unreachable endpoint", () => {
  // This phase CONFIGURES storage (pointed at a dead endpoint) — it must be the
  // last describe; the matrix above depends on the unconfigured state.
  const VALID_BODY = {
    endpoint: DEAD_ENDPOINT,
    region: "us-east-1",
    bucket: "matrix-wiki-bucket",
    accessKeyId: "matrix-wiki-access-key",
    secretAccessKey: SECRET_VALUE,
    publicBaseUrl: "https://cdn.matrix.test",
    publicPrefix: "wiki-public",
    privatePrefix: "wiki-private",
    maxUploadMb: 1,
  };

  test("PUT with an empty body → 400 naming every missing field", async () => {
    const response = await api("/api/storage/settings", {
      method: "PUT",
      cookie: cookies.admin,
      body: {},
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid storage settings",
      errors: {
        region: "Region is required",
        bucket: "Bucket is required",
        accessKeyId: "Access key id is required",
        secretAccessKey: "Secret access key is required",
      },
    });
  });

  test("PUT with a bad bucket / endpoint / maxUploadMb → 400 per field", async () => {
    const response = await api("/api/storage/settings", {
      method: "PUT",
      cookie: cookies.admin,
      body: {
        ...VALID_BODY,
        bucket: "Bad_Bucket!",
        endpoint: "127.0.0.1:1",
        maxUploadMb: 11,
      },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Invalid storage settings",
      errors: {
        bucket: "Bucket must be a valid S3 bucket name",
        endpoint: "Endpoint must be an http(s):// URL",
        maxUploadMb: "Max upload must be a whole number between 1 and 10",
      },
    });
  });

  test("PUT valid settings → masked view; the secret never leaves the server", async () => {
    const response = await api("/api/storage/settings", {
      method: "PUT",
      cookie: cookies.admin,
      body: VALID_BODY,
    });
    expect(response.status).toBe(200);
    const settings = (response.body as { settings?: Record<string, unknown> }).settings;
    expect(settings).toMatchObject({
      endpoint: DEAD_ENDPOINT,
      region: "us-east-1",
      bucket: "matrix-wiki-bucket",
      accessKeyId: "matrix-wiki-access-key",
      hasSecret: true,
      maxUploadMb: 1,
      configured: true,
    });
    // THE masked-secret invariant: no key, no value, anywhere in the payload.
    expect(settings).not.toHaveProperty("secretAccessKey");
    expect(JSON.stringify(response.body)).not.toContain(SECRET_VALUE);

    // The GET shape is masked identically.
    const read = await api("/api/storage/settings", { cookie: cookies.admin });
    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({ configured: true });
    expect(JSON.stringify(read.body)).not.toContain(SECRET_VALUE);

    // The stored row, read straight from pg, DOES hold the plaintext — the
    // accepted tradeoff (DB-side secret, API-side masking), asserted as-is.
    const stored = (await storedStorageSettings()) as Record<string, unknown> | null;
    expect(stored?.secretAccessKey).toBe(SECRET_VALUE);
  });

  test("PUT with an empty secret keeps the stored one (masked form round-trips)", async () => {
    const response = await api("/api/storage/settings", {
      method: "PUT",
      cookie: cookies.admin,
      body: { ...VALID_BODY, secretAccessKey: "", region: "eu-west-1" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ settings: { region: "eu-west-1", hasSecret: true } });
    const stored = (await storedStorageSettings()) as Record<string, unknown> | null;
    expect(stored?.secretAccessKey).toBe(SECRET_VALUE);
    expect(stored?.region).toBe("eu-west-1");
  });

  test("the settings mutation audits WITHOUT the secret in the diff", async () => {
    const rows = await wikiAuditRows("storage:settings", "storage.settings.updated");
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const actor = await userIdByEmail(FIXTURE_EMAILS.admin);
    expect(rows.every((row) => row.actor_id === actor)).toBe(true);
    // Not even the audit trail may carry it.
    for (const row of rows) {
      expect(JSON.stringify(row.diff)).not.toContain(SECRET_VALUE);
    }
    expect(rows.at(-1)?.diff).toMatchObject({
      region: "eu-west-1",
      bucket: "matrix-wiki-bucket",
      maxUploadMb: 1,
    });
  });

  test("connection test against the configured-but-dead endpoint → 400 with the SDK's error", async () => {
    const response = await api("/api/storage/settings/test", {
      method: "POST",
      cookie: cookies.admin,
      body: {},
    });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ ok: false, error: expect.any(String) });
  });

  test("upload above maxUploadMb → 400 with the ceiling; below it → the SDK is reached (500), and no row is written", async () => {
    const pageId = await newPage("Matrix Wiki Sizelimits");
    const oversize = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId },
      files: {
        file: { name: "big.txt", type: "text/plain", bytes: new Uint8Array(2 * 1024 * 1024) },
      },
    });
    expect(oversize.status).toBe(400);
    expect(oversize.body).toMatchObject({ error: expect.stringContaining("limit is 1 MB"), maxUploadMb: 1 });

    const small = await apiForm("/api/wiki/attachments", {
      cookie: cookies.admin,
      fields: { pageId },
      files: {
        file: {
          name: "small.txt",
          type: "text/plain",
          bytes: new TextEncoder().encode("tiny"),
        },
      },
    });
    // Storage IS configured now, so the request reaches PutObject, which
    // cannot connect — a server-side failure, and crucially NO metadata row
    // and NO audit row survive the failed put.
    expect(small.status).toBe(500);
    const rows = await getPool().query(
      `SELECT id FROM wiki_attachments WHERE page_id = $1`,
      [pageId],
    );
    expect(rows.rows).toHaveLength(0);
    expect(await wikiAuditCount(`page:${pageId}`, "attachment.created")).toBe(0);
  });

  test("GET /api/wiki/files/[id]: private → 302 to a presigned URL, public → 302 to the CDN", async () => {
    // Presigning is offline — no S3 needed to prove the redirect contract.

    // Private: signed, short-lived, path-style under the dead endpoint.
    const privateResponse = await fetchRaw(`/api/wiki/files/${attachmentFileId("private")}`, cookies.admin!);
    expect(privateResponse.status).toBe(302);
    const privateLocation = privateResponse.headers.get("location") ?? "";
    expect(privateLocation).toContain(
      `${DEAD_ENDPOINT}/matrix-wiki-bucket/wiki-private/${attachmentHostPageId}/`,
    );
    expect(privateLocation).toContain("X-Amz-Signature=");

    // Public: the configured base + key, no signing at all.
    const publicResponse = await fetchRaw(`/api/wiki/files/${attachmentFileId("public")}`, cookies.admin!);
    expect(publicResponse.status).toBe(302);
    expect(publicResponse.headers.get("location")).toBe(
      `https://cdn.matrix.test/wiki-public/${attachmentHostPageId}/fixture-public.txt`,
    );
  });
});

/** Manual-redirect fetch: the 302 itself is the assertion target — following a
 *  presigned URL for a dead endpoint would only yield a network error. */
async function fetchRaw(path: string, cookie: string): Promise<Response> {
  const url = process.env.MATRIX_BASE_URL;
  if (!url) throw new Error("MATRIX_BASE_URL is not set");
  return fetch(`${url}${path}`, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
}

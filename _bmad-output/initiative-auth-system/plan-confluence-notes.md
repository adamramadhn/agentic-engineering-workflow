---
title: 'Wiki: Confluence-style notes — rich editor, S3 uploads, comments, labels, admin storage config'
type: 'feature'
ticket: ''
created: '2026-11-04'
status: 'built'
baseline_revision: '42d65915792946e374a7ac04aec7ffa99cb66a60'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The app has no shared knowledge space — team notes and docs are scattered with nowhere to write rich-formatted pages, attach files, or discuss them in place.

**Approach:** Add a Wiki section: pages written in a tiptap rich-text editor (headings, lists, tables, code blocks, links, images), organized with labels, discussed via comments (author + timestamp), with image/file uploads sent to S3-compatible storage. Storage connection, credentials, and public/private path prefixes are configured by an admin on a new `/storage` admin page and stored in the DB — not `.env`. The Admin role's `*` seed auto-gains the new permission keys; other roles receive them via `/permissions`.

## Boundaries & Constraints

**Always:** every new API route guards via `requirePermission` and validates manually (repo has no zod) answering `Response.json({ error }, status)`; schema changes are one append-only idempotent v4 block inside `ensureSchema()`; uploads flow through a route handler `request.formData()` (never server actions — 1 MB cap; proxy buffers ≤10 MB → default max upload 10 MB, admin-tunable down); page content is tiptap JSON rendered by a read-only editor instance — never `dangerouslySetInnerHTML`; every image/file src inside content is `/api/wiki/files/{attachmentId}` (permission-checked redirect), never a raw S3 URL; `secretAccessKey` is write-only — GET responses omit it; every wiki/storage mutation writes a `wiki_audit` row.

**Never:** no realtime collaboration, version history, full-text search, or spaces/tree hierarchy (flat page list, URL by id); no file bytes in Postgres; no hand-rolled S3 signing (AWS SDK only); don't touch auth flows, JWT shape, refresh rotation, v1–v3 DDL, or `users.role`; Editor/Member seed arrays may only gain wiki keys (fresh DBs only — existing databases get wiki via `/permissions` grants); don't gate uploads on S3 availability for page editing itself (editor degrades, page still saves).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Create page | `POST /api/wiki/pages` `{title,labelIds[]}` with `wiki.create` | 201 `{page}` + audit `page.created` | 400 title empty/>200 chars; 403 |
| Save content | `PATCH /api/wiki/pages/[id]` `{content}` tiptap JSON, `wiki.update` | 200 `{page}` with updated_at/updated_by | 400 content not an object; 404; no partial write |
| Upload file | `POST /api/wiki/attachments` formData `(file,pageId,visibility)` `wiki.update`, storage configured, size ≤ max | 201 `{attachment}`; S3 key `${prefix}/${pageId}/${uuid}-${sanitized}`; editor inserts `/api/wiki/files/{id}` | 503 storage unconfigured; 400 oversize/bad mime/missing page; 404 |
| Fetch file | `GET /api/wiki/files/[id]` with `wiki.view` | 302 → presigned URL (private) or public base URL (public) | 403 without perm; 404 |
| Comment | `POST /api/wiki/pages/[id]/comments` `{body}` with `wiki.comment` | 201 `{comment}` (author, timestamp) | 400 empty body; 403 |
| Delete foreign comment | `DELETE /api/wiki/comments/[id]` by non-author without `wiki.delete` | 403 `{error}` | author or `wiki.delete` succeeds + audit |
| Storage settings | `PUT /api/storage/settings` with `storage.manage` | 200 saved; `POST .../test` runs HeadBucket | 400 missing fields; GET omits secret, `hasSecret` flag |
| Delete page | `DELETE /api/wiki/pages/[id]` with `wiki.delete` | 200; comments/attachments/labels rows cascade; S3 prefix cleanup best-effort (failure logged, not blocking) | 404 |

</frozen-after-approval>

## Code Map

- `package.json` — add deps: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-image`, `@tiptap/extension-link`, `@tiptap/extensions` (Placeholder), `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`. Nothing editor/S3-related exists today.
- `src/lib/db.ts` — `ensureSchema()` v3 (memoized, idempotent DDL), `query()` is the only DB door. Append v4 block: `wiki_pages`, `wiki_labels`, `wiki_page_labels`, `wiki_comments`, `wiki_attachments`, `wiki_audit` (mirror `role_audit`: actor_id SET NULL, action TEXT, diff JSONB), `app_settings` (key TEXT PK, value JSONB, updated_at, updated_by). Extend Editor/Member seed arrays with wiki keys (Admin is `["*"]` — auto-covers new keys).
- `src/lib/permissions.ts` — pure client-importable catalog: `VERBS_BY_PAGE` (exhaustive vs nav ids — build fails otherwise), `EXTRA_RESOURCES`, `PERMISSION_LABELS`, `RESOURCE_LABELS`. Add `wiki: [view, create, update, delete, comment]` (add `comment` to `Verb` union) and `storage: [view, manage]`. Update snapshot `src/lib/permissions.test.ts`.
- `src/components/dashboard/navigation.ts` — `WORKSPACE_PAGES` += `{id:"wiki",href:"/wiki",label:"Wiki",icon}`; `ADMIN_PAGES` += `{id:"storage",href:"/storage",label:"Storage",icon}` (icons added to `src/components/icons.tsx`). Sidebar + command palette pick these up automatically.
- `src/proxy.ts` — `PROTECTED_PREFIXES` += `/wiki`, `/storage`. Routing-only, no pg import.
- `src/lib/permission-guard.ts` — `requirePermission(key)` idiom; `guard.user` is the audit actor.
- `src/app/api/roles/[key]/route.ts` — exemplar for Promise params (`await params`), manual validation, error shapes. Next 16.4.1: `params`/`cookies()`/`headers()` async-only; `RouteContext<'/path/[id]'>` helper available.
- `src/lib/roles.ts` — `writeRoleAudit` pattern → mirror as `writeWikiAudit` in new `src/lib/wiki.ts`; `toRoleResponse` row-mapper pattern.
- `src/lib/api.ts` `apiFetch` — client fetch wrapper for all new views.
- `src/app/(workspace)/roles/page.tsx` + `src/components/dashboard/roles-view.tsx` — RSC pattern (Suspense + server permission gate before any query, required by `cacheComponents: true`) and admin form/sheet/dialog/toast patterns (`users-view.tsx` AddUserDialog is the minimal example).
- `src/components/dashboard/page-permission-gate.tsx`, `permission-provider.tsx`, `status/forbidden-view.tsx` — UI gating trio to reuse.
- `src/components/dashboard/ask-ai-content.tsx` `MarkdownRenderer` — exists but hand-rolled; do NOT use for wiki (tiptap renders its own).
- Tests: `tests/matrix/` (per-role HTTP matrix vs prod build, scratch DB, `MATRIX_BASE_URL`; helpers `api()`, `login()`, `seedFixtureUsers()` in `helpers.ts`), `e2e/` (Playwright, port 4311), `npm run verify` = build + lint + unit + matrix + e2e.
- `node_modules/next/dist/docs/` — read before coding (AGENTS.md mandate): route handlers, `proxyClientMaxBodySize` (10 MB body buffering), `formData()` in route handlers, `images.remotePatterns` (NOT needed — wiki images use plain `<img>` behind the API redirect).

## Tasks & Acceptance

**Execution:**
- [ ] `package.json` — install tiptap/S3 deps listed in Code Map (exact tiptap table-extension package per its v3 docs at install time; StarterKit tables if included) — editor + storage stack.
- [ ] `src/lib/permissions.ts` + `src/components/dashboard/navigation.ts` + `src/components/icons.tsx` + `src/proxy.ts` + `src/lib/permissions.test.ts` — add `wiki`/`storage` resources, nav entries, protected prefixes, snapshot — the catalog is the compile-enforced spine.
- [ ] `src/lib/db.ts` — append v4 schema block (tables above, FKs CASCADE for page children, SET NULL for user refs) + seed extension — data model.
- [ ] `src/lib/storage.ts` (new) — settings read/save with validation (endpoint?, region, bucket, accessKeyId, secretAccessKey, publicBaseUrl, publicPrefix, privatePrefix, maxUploadMb), `getS3Client()` built per use from settings, key builder, presign GET, `testConnection` (HeadBucket), mask-on-read — all S3 knowledge in one module.
- [ ] `src/lib/wiki.ts` (new) — row mappers, `writeWikiAudit`, label name normalization, page list/detail queries (labels, author names, comment counts) — model layer mirroring roles.ts.
- [ ] `src/app/api/storage/settings/route.ts` + `src/app/api/storage/settings/test/route.ts` — GET (masked) / PUT (`storage.manage`), POST test (`storage.manage`) — admin config API.
- [ ] `src/app/api/wiki/pages/route.ts` + `[id]/route.ts` + `[id]/comments/route.ts`, `src/app/api/wiki/comments/[id]/route.ts`, `src/app/api/wiki/labels/route.ts` + `[id]/route.ts` — CRUD per I/O matrix.
- [ ] `src/app/api/wiki/attachments/route.ts` (POST upload) + `src/app/api/wiki/files/[id]/route.ts` (302 redirect) — upload + serving.
- [ ] `src/components/wiki/wiki-editor.tsx` (new) — tiptap editor + toolbar (undo/redo, headings, bold/italic/strike/code, lists, quote, code block, link, table, image-upload button, file-attach button) and a read-only renderer variant — one component, two modes.
- [ ] `src/app/(workspace)/wiki/page.tsx` + `src/components/wiki/wiki-view.tsx` — page list: search by title, label filter, create-page dialog (title + labels → POST → route to editor), author + updated timestamps.
- [ ] `src/app/(workspace)/wiki/[id]/page.tsx` + `src/components/wiki/wiki-page-view.tsx` — detail: view/edit toggle (edit needs `wiki.update`), label chips editor, attachments panel (visibility badge per file), comments thread (post `wiki.comment`, author avatar/name, timestamp, author-or-`wiki.delete` removal), storage-unconfigured hint disabling upload buttons.
- [ ] `src/app/(workspace)/storage/page.tsx` + `src/components/dashboard/storage-view.tsx` — admin form: connection fields, secret write-only (placeholder "••••" + `hasSecret`), prefixes, max upload, Test connection button, save — follows roles-view form patterns.
- [ ] `tests/matrix/` + `e2e/` — matrix rows for every new route × role (401/403 happy/validation incl. masked-secret invariant); e2e: admin creates page + label + comment, member views + is denied edit (no S3 in CI: assert unconfigured 503/hint path) — proof at both altitudes.
- [ ] Run `npm run verify` — all green.

**Acceptance Criteria:**
- Given a fresh DB, when an admin opens the app, then Wiki and Storage appear in nav; admin can create a page, insert an uploaded image (storage configured), and save.
- Given a member with only `wiki.view`, when they open the page, then content renders (image loads via 302 presigned redirect) and edit/delete/upload/comment actions are hidden client-side and rejected 403 server-side.
- Given storage is unconfigured, when anyone uploads or clicks Test connection, then upload UI is disabled with a hint and the API answers 503.
- Given a GET on storage settings by a `storage.manage` holder, then the response contains no `secretAccessKey` value.
- Given any wiki/storage mutation, then exactly one `wiki_audit` row with actor/action/diff exists.
- Given `npm run verify`, then build, unit (updated catalog snapshot), matrix (new rows), and e2e all pass.

## Implementation Notes

## Plan Change Log

## Review Triage Log

- `medium` / patch — Quick lens: DELETE `/api/wiki/comments/[id]` gates on `wiki.comment` before the author-or-`wiki.delete` rule. Verified: `src/app/api/wiki/comments/[id]/route.ts:22` runs `requirePermission("wiki.comment")` first, so a role granted `wiki.delete` without `wiki.comment` (constructible via `/permissions`, the plan's own delivery path for existing DBs) is 403'd moderating a foreign comment, and an author whose comment grant was revoked cannot retract their own — both contradict the frozen matrix row "author or `wiki.delete` succeeds + audit". Fix settled by the matrix: entry gate `wiki.view`, keep the author-or-delete rule.
- `medium` / patch — Quick lens: failed upload leaves an unhandled rejection, no user feedback. Verified: HTTP-error uploads DO toast (`wiki-page-view.tsx:222`), but `uploadAttachment` (`wiki-page-view.tsx:214`) awaits `apiFetch` with no try/catch and `upload()` (`wiki-editor.tsx:110`) has `finally` but no `catch`, invoked as `void upload(...)` — a transport-level rejection (dropped connection) silently re-enables the button; every sibling action in the file catches with a "Network error" toast.
- `medium` / patch — Quick lens: per-role 403 rows for the five `wiki.view`-gated read routes are untestable — no fixture lacks `wiki.view`. Verified: `tests/matrix/wiki.spec.ts:41-42` fixtures are admin/editor/member only, and both editor and member seeds include `wiki.view` (`db.ts` v4), so ops 1/3/7/8/15 (GET pages, page, comments, labels, file) never exercise a per-role 403; unmet plan task "matrix rows for every new route × role (401/403 …)". Sibling `matrix.spec.ts` already has the `custom`-fixture pattern (role with exactly `["roles.view"]`).
- `low` / patch — Quick lens: the 10 MB cap is justified by proxy body buffering, which never runs for `/api`. Verified: `src/proxy.ts:72` matcher excludes `api`, so the proxy never executes for `/api/wiki/attachments`; the route's own `file.size` check is the real (and working) ceiling. No behavior bug — misleading comments (`attachments/route.ts` header, `MAX_UPLOAD_MB_CEILING` doc) and the admin-facing `/storage` hint cite a mechanism that doesn't apply. Survives low-rejection: admins read the hint in everyday use and the fix is a direct rewording. Frozen plan text not edited.

## Design Notes

- **tiptap JSON round-trip:** store the ProseMirror doc as JSONB; render with `editable: false` editor — XSS-safe with no sanitizer dependency. Golden key: `${publicPrefix|privatePrefix}/${pageId}/${crypto.randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g,"_")}` (page-scoped prefix makes page-delete cleanup a prefix delete).
- **Content URLs:** image nodes always reference `/api/wiki/files/{attachmentId}`. That route guards `wiki.view`, then 302s to a short-lived presigned URL (private) or the public base URL (public). Plain `<img>` — avoids `next/image` `remotePatterns` + presigned-query 400 pitfalls entirely.
- **Why route handlers, not server actions:** 1 MB server-action body cap vs 10 MB proxy buffering for route handlers — uploads must be route handlers. All other wiki routes stay JSON route handlers for consistency with the repo.
- **Secrets in DB (user decision):** storage credentials live in `app_settings` per the requester's explicit "not .env" requirement; `.env` keeps only `DATABASE_URL`/`AUTH_SECRET`. Accepted tradeoff: secret sits in JSONB plaintext — mitigated by write-only API masking and RBAC; note in UI copy.
- **Permission seeding:** `Admin` seed is `["*"]` so existing databases' admins get wiki/storage automatically at resolve time; Editor/Member seed edits only affect fresh databases — existing roles stay admin-controlled (grants UI), matching the RBAC design's "dead grants inert" philosophy.
- **`comment` verb:** added to the closed `Verb` union — flows through the existing matrix/toggles UI data-driven; keeps "read-only member" expressible.

## Verification

**Commands:**
- `npm run verify` -- expected: build, lint (non-gating), unit incl. updated `permissions.test.ts` snapshot, matrix incl. new wiki/storage rows, e2e incl. wiki happy path — all green.
- `npx vitest run src/lib/permissions.test.ts` -- expected: catalog snapshot matches new wiki/storage keys.

**Manual checks (if no CLI):**
- With real S3/MinIO credentials entered on `/storage` (Test connection green): upload an image inside a wiki page, confirm it renders; open the private object URL logged in vs logged out (403); confirm the public object URL opens anonymously.

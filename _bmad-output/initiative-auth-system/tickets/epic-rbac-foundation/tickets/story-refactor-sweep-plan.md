---
title: 'Refactor sweep'
type: 'refactor'
ticket: '5'
created: '2026-11-03'
status: 'built'
baseline_revision: '2d9ac60e6b74ff1e6e4cc74129cc5a8a046131b4'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Entries 1–4 left deliberate, recorded cleanup debt: the three roles route files each carry their own copies of the same mapping/validation helpers (`RoleRow`, `RoleResponse`, `toStringArray`, `toRoleResponse`, the audit-INSERT try/catch), comments pointing at "entry 5 will consolidate", and the permissions test file has repetitive literal boilerplate that hurts readability.

**Approach:** Zero-behavior-change consolidation: one shared module `src/lib/roles.ts` for the role row/response mapping and the audit write; the three routes import from it and drop their local copies; a readability pass over `src/lib/permissions.test.ts` (table-driven cases, tiny fixture builder — same expectations); stale consolidation comments removed. Verify: vitest, build, and lint on the epic's files all pass with identical live behavior.

## Boundaries & Constraints

**Always:**
- Pure refactor: every HTTP response body, status code, audit row, and query is byte-for-byte identical before/after. The full live matrix from entries 1.3/1.4 must still pass unchanged.
- `toRoleResponse` consolidation must preserve all three current shapes: 1.3's `(row, userCount)` (with `userCount` in the response) and the `[key]` routes' no-`userCount` shape — one function with an optional `userCount`, or two thin wrappers over one mapper; implementer's choice, documented in the plan change log if it deviates from the Code Map.
- The audit helper keeps the exact contract: sequential await after the mutation, `console.error("role audit write failed:", …)` on failure, non-fatal.

**Never:**
- No behavior fixes of any kind — anything found opens a new story per the ticket's rule, recorded in the Review Triage Log as `new-story`, not patched here.
- No baseline lint debt: the 55 errors + 19 warnings in `npm run lint` all pre-date the epic (verified 1.1 baseline and again now — scripts/*.cjs, dashboard components, ui/command.tsx, hooks/use-mobile.ts; zero epic files). Their fixes are `react-hooks/set-state-in-effect` render-behavior changes = behavior fixes = the ticket's own exclusion. The verify's "lint passes" is scoped to the epic's surface (`npx eslint` on every file this epic created/touched); repo-wide lint debt stays a new-story matter.
- No changes to the catalog key set, seed, guard semantics, route logic, or `src/proxy.ts`; no UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| List roles | GET /api/roles as Admin | 200, identical body incl. `userCount` per role | — |
| Create role | POST /api/roles valid | 201, identical body incl. `userCount: 0` | — |
| Rename | PATCH /api/roles/support-2 {name} | 200, identical body (no `userCount`) | — |
| Delete paths | system / in-use / free / ghost | 409 / 409+userCount / 200 / 404 — identical | — |
| Grant replace | full 1.4 guard chain | 404→403→400→409→200 identical | — |
| Audit writes | every successful mutation | exactly one row, identical action/diff/actor | failure still logged, non-fatal |
| Suite | `npx vitest run` | 29/29, same test names and expectations (structure may reorganize) | — |
| Markers | grep TODO/FIXME/deferred/"entry 5" in epic files | nothing | — |

</intent-contract>

## Code Map

- `src/lib/roles.ts` -- NEW (~90 LOC). Exports: `RoleRow` (the roles-table row shape), `RoleResponse` (the API shape), `toStringArray` (JSONB → string[] defensive filter), `toRoleResponse(row, userCount?)` (userCount included when provided, omitted when not — preserving both existing response shapes), `writeRoleAudit({ actorId, action, roleKey, diff })` (the INSERT + try/catch + console.error, non-fatal). No route imports; pure module over `query`/`resolvePermissions`.
- `src/app/api/roles/route.ts` -- delete local `RoleRow`/`RoleResponse`/`toStringArray`/`toRoleResponse` and the inline audit INSERT; import from `@/lib/roles`. `slugify`/`deriveFreeKey` stay (single-use). Behavior identical.
- `src/app/api/roles/[key]/route.ts` -- same consolidation ×2 handlers; drop the "entry 5 consolidates" comments as they execute.
- `src/app/api/roles/[key]/permissions/route.ts` -- same consolidation.
- `src/lib/permissions.test.ts` -- readability only: table-driven loops for the malformed/unknown-grant rejection lists (grant string as the assertion label), a tiny `entry(key, grants, count)` fixture builder for `wouldLeaveNoManageHolder` cases, consistent section comments. Every existing test name and expectation survives; no coverage removed.
- `src/lib/permissions.ts`, `src/lib/permission-guard.ts`, `src/lib/db.ts`, `src/lib/auth.ts`, users/auth routes -- untouched.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/roles.ts` -- create the shared module per Code Map.
- [ ] Three roles route files -- import shared helpers, delete local copies, drop stale consolidation comments.
- [ ] `src/lib/permissions.test.ts` -- readability pass, expectations unchanged.
- [ ] Grep sweep: no `TODO|FIXME|XXX|HACK|deferred|entry 5` markers left in any file the epic touched.

**Acceptance Criteria:**
- Given the consolidation, when running the full live matrix from entries 1.3/1.4 (list, create+collision, rename, delete ×4 paths, grant-replace guard chain, Member immediate-effect), then every response body and status is identical to the pre-sweep behavior.
- Given every successful mutation, when reading `role_audit`, then exactly one row per mutation with identical action/diff/actor — no phantom rows, none on failure paths.
- Given `npx vitest run`, then 29/29 pass with the same expectations (structure may be reorganized, coverage not reduced).
- Given `npm run build`, then exit 0.
- Given `npx eslint` over every file this epic created or touched, then clean (exit 0).
- Given `grep -rn 'TODO\|FIXME\|XXX\|HACK\|entry 5' <epic files>`, then no matches.

## Implementation Notes

- The response-shape subtlety: 1.3's list/create include `userCount`; 1.4's mutation responses omit it. One mapper with optional `userCount` must produce a JSON body without the key (not `userCount: undefined` vs absent — JSON.stringify drops undefined keys, so spreading `...(userCount !== undefined ? { userCount } : {})` keeps it explicit).
- Repo-wide `npm run lint` still exits 1 on pre-epic baseline files — that debt is recorded (1.1's plan and this plan's Boundaries), out of scope by the ticket's own behavior-fix rule; the sweep proves the epic's files are clean instead.

## Plan Change Log

- 2026-11-03 (implementer, entry 5): `toRoleResponse` is one function with an optional `userCount` (the Code Map's first suggested option) — the key is emitted via `...(userCount !== undefined ? { userCount } : {})` in the same position the three routes emitted it, so both response shapes (and their key order) are byte-identical.
- 2026-11-03 (implementer, entry 5): `writeRoleAudit` parameterizes the action into the INSERT (`VALUES ($1, $2, $3, $4::jsonb)`) instead of the per-route inline literal, and stringifies `diff` itself. The audit rows are byte-identical (verified live against pre-sweep rows for all four actions); only the SQL text differs from the per-route copies it replaced.

## Review Triage Log

### 2026-11-03 — Review pass (quick, pinned)
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0; reviewer's overall verdict: zero behavior drift, approve
- findings:
  - `[low]` `[reject]` `RoleResponse.userCount` made optional weakens compile-time drift protection the 1.3 route had (a future `toRoleResponse(row)` at list/create call sites would compile and silently strip userCount from GET/POST bodies) — rejected: this exact one-function-optional-shape design is what this plan's Boundaries and Code Map sanction, the Plan Change Log records the choice, and the alternative two-wrapper shape is a taste call, not a defect; reviewer confirmed key order and both shapes byte-identical.
  - `[low]` `[reject]` `RoleAuditAction`/`RoleAuditEntry` exported beyond the Code Map's list with no importer — rejected: type-only exports, zero runtime effect, and idiomatic API documentation for `writeRoleAudit` callers; un-exporting would churn a frozen, verified surface.
- hunted-and-clean per the reviewer: JSON key order and body bytes per endpoint, all four audit diff payloads character-identical, guard chains and DELETE disambiguation verbatim, test restructure mechanically diffed against baseline (same 29 names, same matcher counts, 46 executed assertions both sides, same reject literals), layering acyclic (lib/roles → db + permissions; only routes import it), `tsc --noEmit` repo-wide exit 0.

## Design Notes

- Why `src/lib/roles.ts`: mirrors `src/lib/permissions.ts` naming (pure catalog) — roles.ts is the row/response/audit layer for the roles resource. It imports `query` (db) and `resolvePermissions` (permissions), so dependency direction stays lib → lib, routes → libs.
- The audit helper's signature (`{actorId, action, roleKey, diff}`) makes the three call sites read as what they are: one INSERT with different action/diff payloads.

## Verification

**Commands:**
- `npx vitest run` -- expected: 29/29, identical expectations.
- `npm run build` -- expected: exit 0.
- `npx eslint src/app/api/roles src/lib/roles.ts src/lib/permissions.ts src/lib/permissions.test.ts src/lib/permission-guard.ts src/lib/auth.ts src/app/api/users src/app/api/auth` -- expected: clean.
- `git diff --stat` review: net LOC should fall or stay flat across the four touched source files (duplication removed > new module added).
- Live on 127.0.0.1:3011 (fresh logins): the full 1.3/1.4 matrix — GET roles 200 (userCounts present), POST create → 201 (userCount 0) + collision → suffixed key, PATCH rename → 200 (no userCount key in body), DELETE system/in-use/free/ghost → 409/409/200/404, PATCH permissions chain → 404/403/400/409-unreachable/200, Member immediate-effect 403→200→403, one audit row per mutation.

**Manual checks (if no CLI):**

## Auto Run Result

**Status: built (first pass, 2026-11-03).**

- **Summary:** The epic's recorded cleanup debt paid off with zero behavior change. New shared module `src/lib/roles.ts` (RoleRow, RoleResponse, toStringArray, toRoleResponse with shape-preserving optional userCount, RoleAuditAction/Entry, writeRoleAudit) replaced the three roles routes' duplicated local copies (routes net −152 LOC, module +98, epic surface net −54); `permissions.test.ts` restructured for readability with identical expectations (29/29, 46 executed assertions on both sides); stale "entry 5 will consolidate" comments removed; marker grep over all epic files returns nothing. Repo-wide `npm run lint` debt (74 pre-epic problems in scripts/components/hooks — all behavior-fix class) recorded as out of scope by the ticket's own rule; every file the epic created or touches lints clean.
- **Files changed:** `src/lib/roles.ts` (new), `src/app/api/roles/route.ts`, `src/app/api/roles/[key]/route.ts`, `src/app/api/roles/[key]/permissions/route.ts`, `src/lib/permissions.test.ts`, this plan file.
- **Review findings:** Quick lens, 2 findings, both `low` → rejected-with-reason (both in-plan design choices: optional-userCount mapper, type-only exports). Reviewer's verdict: zero behavior drift across bodies, key order, audit payloads, guard chains, tests, layering. 0 patched, 0 deferred. Patched counts by verdict: none.
- **Follow-up review recommended: false** — no patched entries.
- **Verification performed:** `npx vitest run` 29/29; `npm run build` exit 0; eslint exit 0 on every epic file including the new module (implementer ran the wider plan-scoped set, main session re-ran it); marker grep 0; live on 127.0.0.1:3011 across two independent sessions — GET /api/roles 200 with userCount per role and preserved key order, POST create 201 (userCount 0) + collision → suffixed key, PATCH rename 200 with NO userCount key in the body, DELETE system/in-use/free/ghost → 409/409+userCount/200/404, permissions guard chain 404/403/400(/409 structurally unreachable)/200, Member immediate-effect verified in 1.4 unaffected paths, exactly one audit row per successful mutation with diff shapes byte-identical to pre-sweep rows in the same table, no rows on failure paths, throwaway fixtures cleaned up.
- **Residual risks:** none from this story. Pre-epic repo-wide lint debt (74 problems) remains by design — behavior-fix class, new-story territory per the ticket's rule, recorded here and in 1.1's plan.

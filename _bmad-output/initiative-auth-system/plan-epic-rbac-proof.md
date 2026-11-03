---
title: 'Refine epic-rbac-proof: story breakdown for fixtures + e2e + CI'
type: 'chore'
ticket: ''
created: '2026-11-03'
status: 'built'
baseline_revision: 'b129402a9383242fd8f39c0071601254b498574a'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['/home/ubuntu/agentic-engineering-workflow/_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md']
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Epic 3 (epic-rbac-proof, R9 / design §9.2–§9.3, §10 step 7) is unrefined — the proof layer (per-role API fixture matrix, per-role e2e, CI wiring) has no story breakdown, so no ticket can be dispatched against it.

**Approach:** Refine the epic in place (`refined: true` + planning decisions in Notes) and author its `tickets.toml` with four stories — test harness (playwright + isolated scratch DB + one-command verify runner), the API fixture matrix, the per-role e2e paths, and CI wiring — sequenced so the suites land on the harness and CI lands last on green suites.

</intent-contract>

## Implementation Notes

Oneshot because this is a planning-docs-only change (epic .md + tickets.toml, ~150 lines, no code). Investigation facts that shaped the breakdown and must survive into the stories: git remote exists (github.com/fatmuh/agentic-engineering-workflow) so GitHub Actions is real CI; no .github/workflows yet; playwright is not installed (vitest only, 29/29 pure); per-run CREATE DATABASE/connect/DROP verified feasible on the project's pg server; repo-wide eslint carries 55 pre-existing errors + 19 warnings in template files outside this initiative's ownership — CI cannot gate on lint without importing that debt; the routes read sessions via the auth cookies layer, so the fixture matrix runs HTTP-level against a real server rather than unit-invoking route handlers.

Implementation (2026-11-03): epic-rbac-proof.md flipped to `refined: true` with four refinement decisions appended to Notes (HTTP-level matrix, per-run scratch DB, Actions CI with non-blocking lint, vitest/playwright split); tickets/epic-rbac-proof/tickets/tickets.toml authored with stories 1–4 (harness → matrix + e2e → CI). Verified via `tickets.py find epic-rbac-proof 3.1|3.2|3.3|3.4` — all four resolve with the intended titles, `after` chains (1 → {2,3} → 4), and risks; the toml parses (find reads it). Working tree: this plan file plus the two refinement artifacts — the Verification line's "two intended files" counts the refinement outputs; the plan file itself is the run's own third artifact.

## Plan Change Log

## Review Triage Log

### 2026-11-03 — Review pass
- verdicts: 7 findings — high 0, medium 4, low 3, false 0, maybe-false 0
- findings:
  - `[medium]` `[patch]` Matrix suite never wired into the one-command runner or CI — story 1's `verify` was "build + vitest + e2e" and no story amended it, so the matrix would run in neither `npm run verify` nor CI (epic Done-when bullets 2 and 4 unmet); verified against story 2's "own config/file pattern" (files plain `vitest run` would not discover) and package.json's `test: "vitest run"`. Patched: entry 2 now ships `test:matrix` wired into `verify`, and entry 1's description says story 2's matrix joins the same command.
  - `[medium]` `[patch]` Matrix runtime prerequisites undefined — entry 2 leaned on "the story-1 harness database" but that database and app exist only inside `playwright test` (webServer + globalSetup); a standalone vitest project had no provisioner and `src/lib/db.ts` throws without DATABASE_URL. Patched: entry 2 provisions its own runtime through story 1's shared harness module via vitest globalSetup, never depending on playwright's runtime.
  - `[medium]` `[patch]` Epic Done-when bullet 1 ("suites run alongside lint/build in one command") unmeetable as written — stories excluded lint entirely while the diff left the Done-when untouched. Patched without touching the epic's contract: entry 1's `verify` runs the repo lint as a reported-but-non-gating stage inside the one command (matching the epic Note), so lint runs alongside build and the suites without gating on pre-existing template debt.
  - `[medium]` `[patch]` Harness DB-injection rested on an unaddressed boot-order assumption — env mutated inside playwright globalSetup reaching the separately spawned webServer process; patched to the robust mechanism: the run-unique DB name is derived once at playwright.config.ts evaluation scope and passed explicitly to both `webServer.env` and globalSetup, with the lifecycle in a shared harness module.
  - `[low]` `[patch]` Entry 4's verify contradicted its description ("job steps run exactly what npm run verify runs" vs provisioning steps) — reworded: the workflow's test step runs exactly `npm run verify`; provisioning is the job's own.
  - `[low]` `[patch]` "Endpoint inventory enumerated at plan time" cited nothing checkable and "guarded route" was ambiguous (requirePermission routes vs /api/auth/* session-401s) — patched: guarded = the requirePermission data routes (users, roles ×2, roles/[key] ×2, roles/[key]/permissions), auth routes are story 3's e2e territory, and the inventory is recorded in story 2's plan before implementation.
  - `[low]` `[reject]` Plan's Verification section carried two defective commands (a `node require` on a .toml and a "two intended files" count vs three changed) — the fix is editing this build's plan, which triage rejects by rule; the executable equivalents (tickets.py find, the parenthetical parse fallback) were what actually ran and are recorded in Implementation Notes.

### 2026-11-03 — Follow-up review pass
- verdicts: 3 findings — high 0, medium 2, low 1, false 0, maybe-false 0 (all six first-pass patches verified as holding; the rejected plan-command finding not re-reported per the carried row)
- findings:
  - `[medium]` `[patch]` "expected 200/403 matrix" contradicted the shipped API — both POST endpoints return 201 (`src/app/api/users/route.ts:110`, `src/app/api/roles/route.ts:146`, confirmed by grep); patched to "success/403 matrix (200 on GETs and PATCHes, 201 on the two POSTs)" with the file:line citations in the story text.
  - `[medium]` `[patch]` "exactly one role_audit row per successful mutation" was unmeetable — role_audit is written only by the roles API (`src/lib/roles.ts:91`, sole INSERT in the tree), and users-create sits in the same matrix; patched to "per successful ROLES mutation" with a users-create asserting no audit side-effect, keeping the epic's no-application-code boundary intact.
  - `[low]` `[patch]` Lint prescribed twice per CI job (inside `verify` and as a separate workflow step) — the two first-pass patches were never reconciled; patched: entry 4 drops the separate lint step, lint runs exactly once via verify's non-gating stage.

## Auto Run Result

**Status: built.** Oneshot (docs-only refinement), Quick review lens run + a follow-up pass after 4 mediums were patched; 9 findings total patched in the refinement artifacts, 1 rejected.

- Files: `_bmad-output/initiative-auth-system/tickets/epic-rbac-proof/epic-rbac-proof.md` (`refined: true` + four refinement decisions in Notes: HTTP-level matrix, per-run scratch DB, Actions CI with non-blocking lint, vitest/playwright split), `_bmad-output/initiative-auth-system/tickets/epic-rbac-proof/tickets/tickets.toml` (NEW — stories 1–4: harness → matrix + e2e → CI, after-chains 1→{2,3}→4).
- Review findings breakdown: first pass 6 patched (medium 4, low 2), 1 rejected (low — fix was editing this build's plan); follow-up pass 3 patched (medium 2, low 1 — 201 statuses, roles-only audit scope, single lint pass), 0 deferred, 0 rejected.
- Follow-up review recommendation: **false** — the follow-up pass patched no high findings (medium 2, low 1), so the work has converged. The first pass's named risk (harness mechanism prescriptions) was re-examined in the follow-up and confirmed coherent with `src/lib/db.ts` (throws without DATABASE_URL; seeds roles inside ensureSchema) and `vitest.config.mts`'s include pattern; the implementation runs of stories 1–2 remain the live proof.
- Verification performed: `tickets.py find epic-rbac-proof 3.1|3.2|3.3|3.4` resolve after every patch round with intact descriptions/verify; toml parses (find reads it); `git status` shows exactly the three intended paths; diff read in full each round.
- Residual risks: none beyond the implementation-run proof above — no application code changed.

## Verification

**Commands:**
- `uv run /home/ubuntu/agentic-engineering-workflow/_bmad/scripts/../method/scripts/tickets.py --project-root /home/ubuntu/agentic-engineering-workflow find 3.1` -- expected: resolves entry 1 of epic-rbac-proof with the harness story (repeat for 3.2–3.4).
- `node -e "const t=require('.../tickets/epic-rbac-proof/tickets/tickets.toml')"` -- toml parses (or equivalent parse via tickets.py list).
- `git status --porcelain` -- expected: only the two intended files changed.

**Manual checks (if no CLI):**
- Epic frontmatter shows `refined: true`; story `after` chains are acyclic (1 → {2,3} → 4); every description names its deliverable and every verify is observable in the running app or CI.

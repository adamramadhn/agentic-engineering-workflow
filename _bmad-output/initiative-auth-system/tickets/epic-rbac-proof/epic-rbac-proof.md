---
type: epic
title: Proof: per-role fixtures and e2e
parent: initiative-auth-system
covers: ["R9"]
sources: []
companions: ["_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md"]
after: ["epic-rbac-admin-experience"]
risk: low
refined: true
---

# Proof: per-role fixtures and e2e

## Description

The closing proof layer: playwright added beside epic 1's vitest, the per-role API fixture matrix (Admin, Editor, Member, one custom role × every guarded endpoint, including lockout 403/409s and audit rows), and the per-role e2e happy paths — sidebar contents, the member 403 deep link, and the admin create-role → toggle → matrix → revoke flow (design §9, §10 step 7).

## Outcome

For the team, what each role can and cannot do is frozen by CI — the design's signal: the suite proves a member without `users.view` gets the 403 view and a 403 API, and that a revoked grant bites on the member's next request.

## Done when

- `vitest` and `playwright` suites run alongside lint/build in one command.
- The fixture matrix (roles × guarded endpoints, 401/403/409 + audit + FK cases) is green.
- The per-role e2e paths are green, including the member-403 deep link and the admin permission-change flow.
- Delivered: the suites run in CI on every change.

## Boundaries

- Owns: test infrastructure wiring (playwright setup, test DB fixtures, CI wiring for the suites), the fixture-matrix suite, the e2e suites.
- Must not change: application code except where a defect the suites expose requires it — such fixes go back through the owning epic's tickets.
- Belongs to siblings: unit tests of the catalog and resolver were epic 1's first stories' work.

## References

- parent — `_bmad-output/initiative-auth-system/initiative-auth-system.md`, Requirement R9
- design — `_bmad-output/initiative-auth-system/brainstorm-rbac-roles-permissions/brainstorm-rbac-roles-permissions.md` (§9 testing plan, §10 build order step 7)

## Notes

- Decision (2026-11-03): proof is its own epic (not scattered stories) so the fixture matrix and e2e land as one coherent, reviewable suite.
- Decision (2026-11-03, refinement): the fixture matrix drives real HTTP against a booted app — not unit-invoked route handlers — because every guarded route reads the session through the request-cookies layer; unit-invocation would mock the layer under test.
- Decision (2026-11-03, refinement): suites run against a per-run scratch database (CREATE/DROP on the project's existing pg server, verified feasible); the dev database is never a test target. The app's own `ensureSchema()` + role seeding bootstrap it, so the fixtures exercise the real boot path.
- Decision (2026-11-03, refinement): CI is GitHub Actions (the repo's remote hosts it). Lint runs reported-but-non-blocking: repo-wide eslint carries 55 pre-existing errors + 19 warnings in template-owned files outside this initiative (recorded out of scope since epic 1); CI gates on build + vitest + playwright via the one-command runner.
- Decision (2026-11-03, refinement): the pure vitest suite (catalog/resolver, epic 1) stays untouched and fast; the matrix runs as its own vitest project against the harness database, and e2e is playwright — `npm test` keeps its current meaning.

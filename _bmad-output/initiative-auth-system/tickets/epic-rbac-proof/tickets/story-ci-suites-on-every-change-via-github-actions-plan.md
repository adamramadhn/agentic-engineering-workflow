---
title: 'CI: suites on every change via GitHub Actions'
type: 'feature'
ticket: '4'
created: '2026-11-03'
status: 'built'
baseline_revision: '8d7fa3556dbe51fb7b84958052685f93073b6dee'
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

**Problem:** The full RBAC verification stack — `next build`, unit vitest, the 47-test HTTP fixture matrix, and the 17-test Playwright e2e suite, all over per-run scratch databases — runs only on a developer machine. Nothing runs it on every change.

**Approach:** One GitHub Actions workflow, `.github/workflows/ci.yml`, that provisions what `npm run verify` needs on an ubuntu runner (checkout, Node 22 with npm cache, `npm ci`, a postgres:16 service container exposed on localhost:5432 with `DATABASE_URL` pointing at it, Playwright's chromium) and then runs exactly `npm run verify` — the same one command as local. Provisioning is the job's own; the test step is the single command. No separate lint step exists anywhere: lint already runs inside verify as a reported, non-gating stage (the 74 pre-existing template-file problems are documented outside this initiative and must not gate CI). No application-code changes.

## Boundaries & Constraints

- **The test step is exactly `npm run verify`** — not a reimplementation of its stages, not a subset. If CI needs more than provisioning + that one command, the harness is wrong, not the workflow.
- **No separate lint step** anywhere in the workflow (no `npm run lint` run, no `continue-on-error` lint theater). Lint's place is inside verify's non-gating stage, exactly once.
- **No product/harness code changes** — `src/`, `scripts/`, `e2e/`, `tests/`, `playwright.config.ts`, `package.json` are untouched. If the suites cannot pass on a clean runner, that is a finding for the relevant story, not a patch here.
- **Dev-database irrelevance:** CI has no `.env.local`; every harness reads `DATABASE_URL` from the environment (`scripts/test-db.mjs` `baseConnectionString()` prefers `process.env.DATABASE_URL`; `src/lib/db.ts:7` reads it directly), so a single job-level `DATABASE_URL` to the service container feeds the build, the matrix scratch DBs, and the e2e scratch DB alike. Scratch-db CREATE/DROP needs a superuser — the service container's `postgres` user is one.
- **Do not push.** The workflow's live run is the remote's job once the user pushes; this story's verification is static (parser + structural assertions).

## Investigation Facts (verified against baseline 8d7fa35)

- `npm run verify` (package.json): `next build && (npm run lint || echo "[verify] lint reported issues — non-gating") && npm test && npm run test:matrix && npm run test:e2e` — lint appears exactly once, non-gating.
- Harness ports: e2e webServer binds 127.0.0.1:4311, matrix globalSetup spawns on 4312 — no service conflicts on a dedicated runner.
- Playwright needs its browser: `npx playwright install --with-deps chromium` (@playwright/test ^1.64.1; `--with-deps` uses the runner's sudo to install system libraries).
- Node: no `engines` pin in package.json; local dev runs v22; Next 16.4.1 requires ≥20.9 — pin `22` in setup-node with `cache: npm`. `package-lock.json` exists → `npm ci`.
- Postgres service: `postgres:16` image, `POSTGRES_PASSWORD: postgres`, ports `5432:5432`, health-check `pg_isready`; job env `DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres` (localhost, not the service name — the runner talks to the container map, not DNS).
- No `.github/` directory exists today; git remote `origin` is configured (github.com/fatmuh/agentic-engineering-workflow).
- actionlint is not installed locally; python3 + pyyaml is available as the equivalent parser fallback.

## Implementation Tasks

### 1. `.github/workflows/ci.yml` (~45 LOC, the only file)

```yaml
name: CI
on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      DATABASE_URL: postgres://postgres:postgres@localhost:5432/postgres
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - name: Verify (build, lint non-gating, unit, matrix, e2e)
        run: npm run verify
```

Notes pinned: `on.push` with no filter (every branch, matching "on every change") + `pull_request`; the comment-free single command step name documents lint's non-gating membership without adding a step.

## Matrix Test Audit (every I/O row → a passing test)

| # | Input (state/action) | Output (observable) | Check |
|---|---|---|---|
| 1 | Workflow file read by a YAML parser | parses as a mapping with `name`, `on.push`, `on.pull_request`, one job | structural check |
| 2 | The job's steps | checkout → setup-node(cache npm) → npm ci → playwright install → exactly one `npm run verify` run step | structural check |
| 3 | Every step's run/command text | the string `npm run lint` appears in NO step (lint lives only inside verify) | structural check |
| 4 | Service + env | postgres service with health check on 5432; job DATABASE_URL points at localhost:5432 | structural check |
| 5 | Full file through actionlint (or pyyaml equivalent when offline) | accepted with no workflow-schema errors | verification run |

## Verification

```bash
# parser + structural assertions (equivalent-validator clause of the ticket):
python3 - <<'PY'
import yaml
d = yaml.safe_load(open('.github/workflows/ci.yml'))
job = d['jobs']['verify']
steps = job['steps']
runs = [s.get('run', '') for s in steps]
assert 'push' in d[True] or 'push' in d['on'], d  # YAML 1.1 parses bare `on:` as True
assert 'pull_request' in (d[True] if True in d else d['on'])
assert any('npm run verify' in r for r in runs)
assert sum('npm run verify' in r for r in runs) == 1
assert not any('npm run lint' in r for r in runs)
assert 'postgres' in job['services'] and '5432:5432' in job['services']['postgres']['ports']
assert 'localhost:5432' in job['env']['DATABASE_URL']
print('ci.yml structural checks: OK')
PY
# schema validator if the network allows fetching actionlint:
bash <(curl -s https://raw.githubusercontent.com/rhysd/actionlint/main/scripts/download-actionlint.sh) \
  && ./actionlint -version && ./actionlint .github/workflows/ci.yml && echo "actionlint: OK"
```

Also re-run `npm run verify` once locally to confirm the one command the workflow pins is still green at this revision (it ran green at 8d7fa35 minutes ago; re-run only if any file changed since).

## Out of Scope

- Any application/harness/test-code change (frozen here; findings route back to their stories).
- Separate lint/typecheck jobs, matrix-strategy jobs (one OS, one Node), artifact upload, caching beyond setup-node's npm cache, branch filters, concurrency groups.
- Pushing to the remote (the live CI run is the user's push; failures there loop back per the ticket).

## Residual Risks

- `actions/checkout@v5` / `actions/setup-node@v4` major tags: v5 checkout exists as of late 2025; if GitHub resolves otherwise at push time, the run fails loudly at the action-resolution step and loops back — acceptable, visible, one-line fix.
- Runner chromium install adds ~1 min; verify's five stages add ~4–6 min — no timeout tuning unless a live run shows need.
- The `on:` → YAML 1.1 `True` quirk is handled by the structural check reading both keys; actionlint (YAML 1.2) reads `on` natively.

<plan-change-log>

</plan-change-log>

## Review Triage Log

### 2026-11-03 — Review pass 1 (Quick)
- verdicts: 2 findings — high 1, medium 0, low 0, false 1, maybe-false 0
- findings:
  - `[high]` `[patch]` ci.yml set DATABASE_URL but not AUTH_SECRET — verified real: src/lib/jwt.ts:19-22 throws at module load without it, .gitignore excludes `.env*`, and scripts/e2e-server.mjs:126 requires a 401 from POST /api/auth/login that a crashed server can never answer, so `npm run verify` would go red on the first push (the workflow's entire purpose defeated). Locally it works only because test-db.mjs's loadTestEnv() copies every .env.local var into the runner env — CI has no file. Patched (oneshot, by the orchestrator): job env gains `AUTH_SECRET: ci-only-0123…` (≥32-char documented CI throwaway; tokens never leave the runner). Re-verified: structural checks + actionlint green, plus a live CI-shape simulation — `.env.local` removed, only DATABASE_URL+AUTH_SECRET exported → `npm run test:e2e` 17/17 with the scratch DB dropped, `.env.local` restored after.
  - `[false]` `[reject]` plan frontmatter `status: 'in-progress'` in the staged diff — the working tree already read `in-review` when the lens looked (it said so itself), and the committed file carries `built`; a diff is a moment-in-time snapshot by design. No bad outcome exists in any final state.

## Auto Run Result

**Status: built.**

- Summary: `.github/workflows/ci.yml` — on push and pull_request, one `verify` job: checkout, Node 22 with npm cache, `npm ci`, `npx playwright install --with-deps chromium`, a postgres:16 service container (health-checked on 5432), job env `DATABASE_URL` (localhost service URL) + `AUTH_SECRET` (CI-only throwaway), and a single test step running exactly `npm run verify`. No separate lint step anywhere — lint runs once, non-gating, inside verify.
- Files changed: `.github/workflows/ci.yml` (NEW, 47 lines), this plan.
- Review findings breakdown: 1 high patched (missing AUTH_SECRET — jwt.ts fail-fast + boot-probe chain verified against the code, fix proven by a live CI-shape simulation), 1 false rejected (diff-snapshot status artifact). Deferred: none.
- Follow-up review recommendation: false — the pass patched one high, but the patch is a one-line env addition whose necessity and sufficiency are both empirically proven (fail-fast chain read; 17/17 e2e under the exact CI env shape); no unverified risk remains to name.
- Verification performed: pyyaml structural assertions OK (push+pull_request triggers, exactly one `npm run verify` run, zero `npm run lint` steps, service ports/health, DATABASE_URL localhost shape, AUTH_SECRET present ≥32 chars); actionlint 1.7.7 (linux/arm64) — no findings; CI-shape simulation (no .env.local, only the two job env vars) → `npm run test:e2e` 17/17, scratch DB dropped; no code files touched since the last green `npm run verify` at 8d7fa35, so the one command the workflow pins is that green run.
- Residual risks: `actions/checkout@v5` major tag resolves at push time (a miss fails loudly at step 1 and loops back here); first live CI run (~6–8 min est.) happens on the user's push — failures there loop back per the ticket.

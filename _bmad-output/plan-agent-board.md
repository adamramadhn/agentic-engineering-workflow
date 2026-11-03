---
title: 'Agent Board'
type: 'feature'
ticket: ''
created: '2026-11-02'
status: 'in-review'
baseline_revision: 'NO_VCS'
route: 'full'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: []
review_loop_iteration: 0
context:
  - '/home/ubuntu/moccilabs/mistral-template/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no dedicated view for agent tasks waiting for input, running, or finished. The user wants Agent Board as a separate sidebar item directly below Home, modeled on the supplied Affect UI agent-inbox screenshot.

**Approach:** Add a dashboard view using existing query routing. Recreate the reference as original reusable components with monochrome light/dark styling, shadcn primitives, Hugeicons, and clearly labeled local demo data.

## Boundaries & Constraints

**Always:** Preserve Home, its single-level navigation, breadcrumb position, and 16px mobile/24px desktop gutters. Place Agent Board immediately after Home on mobile and desktop. Show Needs You, Running, Done with counts and compact cards containing title, truncated description, execution state, duration, message count, and tool count. Provide accessible task details and local approve/resume/retry actions. State is session-only; no agents actually execute.

**Never:** Access paid source code, add backend services or icon libraries, restyle unrelated pages, add KPI panels/marketing slogans, recreate Home submenus, fix unrelated lint issues, commit/push, or change Tailscale exposure.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Behavior | Error Handling |
|----------|--------------|-------------------|----------------|
| Initial | Five reference tasks | Needs You 2, Running 2, Done 1 | Deterministic sample data |
| Waiting | Approve/resume Migrate users table | Moves to Running; counts and details update | Clearly a local demo change |
| Failed | Retry Clean up CRM contacts | Moves to Running; failure clears | No network request |
| Running | Open details | Execution summary and metrics | No simulated automatic completion |
| Done | Open details | Read-only completion summary | No resume/retry |
| Empty column | Resume both Needs You tasks | Zero count and quiet empty state | Column stays visible |
| Navigation | Direct URL/reload/back/forward | Correct view, selection, breadcrumb | Preserve invalid-route fallback |

</frozen-after-approval>

## Code Map

- `src/components/dashboard/dashboard-shell.tsx`: `ROUTE_CONFIG`, conditional main views, query URL/popstate synchronization. Add `agent-board`; preserve header and navigation conventions.
- `src/components/dashboard/app-sidebar.tsx`: shared `navItems` drives desktop/mobile; insert after Home. Existing callbacks handle collapsed/mobile navigation.
- `src/components/dashboard/command-palette.tsx`: add Agent Board command after Home.
- `src/components/icons.tsx`: reuse Hugeicons `Bot`, `Sparkles`, `MessageSquare`, `Settings`, `Loader2`, `AlertTriangle`, `AlertCircle`, `Check`.
- `src/components/ui/{button,badge,dialog,tooltip}.tsx`: reuse current shadcn/Base UI APIs after reading them.
- `src/components/dashboard/home-view.tsx`: leave unchanged; regression baseline.
- Installed Next guide read: `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`.
- Visual authority: user screenshot `/home/ubuntu/.t3/userdata/attachments/91ac0e95-01a9-4017-9c40-45be35fd16a7-0b959da8-3862-4907-b505-11c59043226c.png`. Public preview failed tool parameter validation; no premium source accessed.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/dashboard/agent-board-data.ts`: typed states, transitions, and five reference tasks: Migrate users table, Clean up CRM contacts, Review PR #482, Release notes v2.4, Weekly metrics digest. Include descriptions, durations, message/tool counts, and detail content.
- [x] `src/components/dashboard/agent-board.tsx`: reusable board/column/card with typed data and callbacks. Compact inset columns, thin borders, approximately 12px card radii, small uppercase labels, 13–14px text, two-line descriptions, status/metrics footer. Native buttons, visible focus, no nested buttons.
- [x] `src/components/dashboard/agent-board-view.tsx`: own local state and shadcn detail dialog. Select by task ID to avoid stale details after transitions. Approve/resume/retry and empty-column states; subtle sample-data note.
- [x] `src/components/dashboard/{dashboard-shell,app-sidebar,command-palette}.tsx`: wire route, breadcrumb, icon, sidebar position, and keyboard command. Preserve Home.
- [x] `scripts/check-agent-board.cjs`: repeatable Playwright checks covering matrix transitions, mobile/desktop navigation, keyboard dialog, overflow, and Home regression. Reuse installed browser tooling; always close browser.

**Acceptance Criteria:**
- Given desktop navigation, when Agent Board is selected, then it appears directly below Home, URL becomes `/?route=agent-board`, and breadcrumb reads Agent Board.
- Given either theme, when the initial board renders, then all five reference titles occupy the correct three columns with compact monochrome styling and correct counts.
- Given a narrow viewport, when reading or opening cards, then all columns are reachable, document width does not overflow, and the dialog remains usable.
- Given Home before and after visiting Agent Board, when viewing its content, then existing summary cards, lower panels, and gutters remain unchanged.
- Given keyboard focus on a card, when activating it and pressing Escape, then its detail opens/closes and focus returns appropriately.

## Implementation Notes

- Implemented directly because native agent execution requires a git worktree unavailable in this non-git project. No child performed implementation. Existing integration files were saved before edits under `/tmp/agent-board-baseline`; actual change diff at `/tmp/agent-board-changes.diff` inspected in full.
- Added reusable board/column/card/status components, typed demo data and guarded transitions, local detail view, sidebar/query route and command entry, plus browser smoke script. Home source checksums unchanged.
- Baseline and final `npm run build` passed; `npx tsc --noEmit` passed. Targeted source ESLint: 0 errors, 7 pre-existing warnings in sidebar/command palette.
- All seven I/O matrix rows covered and passed in `node scripts/check-agent-board.cjs`: initial counts, waiting approval, failed retry, read-only running, read-only done, empty column, URL/reload/back/forward. Additional keyboard focus, command palette, mobile navigation/dialog bounds/overflow checks passed with no page errors.
- Initial keyboard test caught lost focus after moved cards; fixed by retaining last-opened task ID and looking up its current DOM node on dialog close. Re-run passed.
- Inspected desktop dark and mobile light screenshots under `/tmp/agent-board-check`; layout follows reference density with neutral icons, wider desktop canvas, and stacked mobile columns. No premium assets downloaded.
- Human renegotiation (2026-11-02): verified the live Affect UI demo with local Playwright — cards are inline single-open accordions (`aria-expanded`/`aria-controls`, fold region inside the card), never modals; waiting cards carry Reject+Approve, failed carry Retry, Approve/Retry move the card to Running. Rebuilt `agent-board.tsx`/`agent-board-view.tsx` accordingly, removed the Dialog, extended data with `agent` and `steps`, renamed `messages` to `sources`, and switched meta icons to Search + new `Wrench` (Wrench01Icon) in the Hugeicons wrapper. Demo evidence in `/tmp/affect-agent-inbox/` (structure, card/fold HTML, computed styles). Updated `scripts/check-agent-board.cjs` to assert accordion behavior; 10/10 checks pass, `npm run build` and `tsc` pass.
- Motion pass (2026-11-02, later): integrated the transitions.dev Accordion (`transitions/accordion.md`) — the fold is now always mounted and toggled via `data-open` on the card `li`; height animates `grid-template-rows: 0fr↔1fr` with opacity/blur fade on `.t-acc-panel-inner`, chevron flips `scaleY(-1)`, closed panels carry `inert`. Motion tokens `--acc-*` live in `globals.css` with the mandatory `prefers-reduced-motion` guard. Gotcha found by test: vertical padding on the `0fr` grid item leaves a 12px residual strip in Chromium — padding must sit on a grandchild of the panel track. Added card micro-interactions (hover lift + shadow, press scale, 900ms muted flash via `data-just-moved` when a card lands in a new lane), all `motion-reduce`-guarded.
- Human renegotiation (2026-11-02, motion pass): cards are now multi-open — opening one card must not collapse the others (departs from the Affect UI single-open demo); approve/reject still collapse only the acted-on card. `openId: string | null` became `openIds: readonly string[]` throughout.
- Stepper rail rebuilt per-segment (`start-[1.5px] top-[9.5px] bottom-[-15.5px]`) so it runs bullet-center to bullet-center and stops at the last dot instead of overshooting the container; `leading-[19px]` centers dots on the first text line (measured 0px deviation), logical `start-*`/`ps-*` for RTL.
- Throwaway states workbench at `src/app/states/agent-board/` (page + fixtures + switcher CSS, state-machine skill): 9 states in Board and Open card groups, `__state` param, arrow-key stepping, `H` hides the switcher; verified each state renders via Playwright. Deleting that folder removes it entirely.
- Button standard (2026-11-02): the user supplied a self-contained clean-style Button (`src/components/ui/button-clean.tsx`, `.ui-buttonc`, primary/secondary/ghost/destructive × sm/md/lg, styles injected via React 19 `<style href precedence>`); Agent Board card actions now use it (Reject `secondary/sm`, Approve/Retry `primary/sm`). One lint fix from the paste: the mount-ready flag is set imperatively (`setAttribute("data-ready", "")` in a layout effect) because `react-hooks/set-state-in-effect` rejects setState-in-effect. The old shadcn `ui/button.tsx` still serves 15 template files (Home included, frozen) — no mass migration.
- Color & font pass (2026-11-02): user relaxed strict monochrome for Agent Board state indicators — scraped the live Affect demo again for exact values; only icons are colored, labels stay muted (Affect behavior). Tokens `--agent-{waiting,failed,running,done}` in `globals.css` (`#e8a20c/#e5484d/#2f6bff/#22a05a`, lighter dark-mode pair) applied to status icons and lane-header sparks. Button font hardcoding Inter replaced with `font-family: inherit`, so buttons render Geist like the rest of the app. Dev-service gotcha: a `globals.css` edit was missed by the watcher and the token declarations silently never compiled — verified against the served chunk (`grep 'agent-waiting:'`) and forced a recompile with a real content change; computed colors confirmed exact in light and dark.
- Typography pass (2026-11-02): lane headings were 11px/400 muted ("ketipisan") — now `font-medium` (500); count pills got `tabular-nums` since counts change on approve/retry. Audited all visible headings on the board and states routes via computed styles; card titles 14px/500, breadcrumb 13px/500, descriptions 13px/19 were already fine. Home's H1 (16px/400) noted but left untouched — Home is frozen.
- Tabs (2026-11-02): added shadcn Tabs (Base UI) to the Agent Board view with the transitions.dev Tabs-sliding transition (`transitions/tabs-sliding.md`) — `Board` (DashboardSquareIcon; BoardIcon is paid) and `Worktree` (GitBranch) triggers, pill measured via offsetLeft/offsetWidth (snap on mount/resize/font-load, animate on change), tokens mapped to project monochrome vars for auto dark mode, plus a `data-active` bridge because Base UI doesn't set aria-selected. Worktree panel holds a quiet empty state (no real worktree data). Smoke suite extended to 11 checks (tab switch, pill movement, panel swap) — all pass.

## Plan Change Log

## Review Triage Log

## Design Notes

Clone the component, not Affect UI's entire site. Use three equal desktop columns with approximately 8px gaps; stack on mobile. Preserve compact spacing without forcing the reference's fixed screenshot width. Neutral state icons and explicit labels communicate status without relying on color. No gradients or decorative dashboard filler. Demo data is deterministic; running tasks do not imply real execution.

## Verification

- `npx tsc --noEmit`: no errors.
- Targeted `npx eslint` on touched files: no new errors; distinguish existing warnings.
- `npm run build`: successful production compilation, otherwise report exact blocker.
- `node scripts/check-agent-board.cjs`: interaction, navigation, transitions, empty state, and overflow checks pass against localhost.
- Inspect local Playwright screenshots at desktop/mobile and light/dark against the reference. Do not use preview tools to verify own edits; report adaptations instead of claiming pixel identity.
- No git repository exists: baseline revision is empty; inspect touched files directly and do not invent a revision.

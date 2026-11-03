Read the plan holding the acceptance criteria and intent, followed by its context and repository rules.

## Plan
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


## Context and repository rules: AGENTS.md
<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


Then read the unified diff below — it is the change under review.

## Unified diff
```diff
--- a/dashboard-shell.tsx
+++ b/dashboard-shell.tsx
@@ -3,7 +3,7 @@
 import { useState, useEffect } from "react";
 import Link from "next/link";
 import { useRouter, usePathname } from "next/navigation";
-import { RefreshCw, Wand2 } from "@/components/icons";
+import { Bot, RefreshCw, Wand2 } from "@/components/icons";
 import { SidebarProvider, useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
 import {
   Breadcrumb,
@@ -20,6 +20,7 @@
 import { ThemeCustomizerSheet } from "./theme-customizer-sheet";
 import { ConnectPage } from "./connect-page";
 import { HomeView } from "./home-view";
+import { AgentBoardView } from "./agent-board-view";
 import { MetricsView } from "./metrics-view";
 import { CustomersView } from "./customers-view";
 import { ReportsView } from "./reports-view";
@@ -42,6 +43,7 @@
   { label: string; icon: React.ComponentType<{ className?: string }> }
 > = {
   home: { label: "Home", icon: HomeIcon },
+  "agent-board": { label: "Agent Board", icon: Bot },
   metrics: { label: "Metrics", icon: MetricsIcon },
   customers: { label: "Customers", icon: CustomersIcon },
   reports: { label: "Reports", icon: ReportsIcon },
@@ -186,6 +188,14 @@
             </main>
           )}
 
+          {route === "agent-board" && (
+            <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-[24px] pb-8 custom-scrollbar">
+              <div className="w-full">
+                <AgentBoardView />
+              </div>
+            </main>
+          )}
+
           {route === "metrics" && (
             <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-[24px] pb-8 custom-scrollbar">
               <div className="w-full">
--- a/app-sidebar.tsx
+++ b/app-sidebar.tsx
@@ -12,6 +12,7 @@
   Check,
   Plus,
   Building,
+  Bot,
 } from "@/components/icons";
 import {
   DropdownMenu,
@@ -70,6 +71,7 @@
 
   const navItems = [
     { id: "home", label: "Home", icon: HomeIcon },
+    { id: "agent-board", label: "Agent Board", icon: Bot },
     { id: "metrics", label: "Metrics", icon: MetricsIcon },
     { id: "customers", label: "Customers", icon: CustomersIcon },
     { id: "reports", label: "Reports", icon: ReportsIcon },
--- a/command-palette.tsx
+++ b/command-palette.tsx
@@ -5,6 +5,7 @@
 import { useRouter } from "next/navigation";
 import {
   Bell,
+  Bot,
   Check,
   CreditCard,
   Database,
@@ -82,6 +83,12 @@
             <span>Home</span>
           </CommandItem>
           <CommandItem
+            onSelect={() => handleSelect(() => onNavigate?.("agent-board"))}
+          >
+            <Bot className="size-4 text-neutral-500" />
+            <span>Agent Board</span>
+          </CommandItem>
+          <CommandItem
             onSelect={() => handleSelect(() => onNavigate?.("metrics"))}
           >
             <LineChart className="size-4 text-neutral-500" />
--- /dev/null
+++ src/components/dashboard/agent-board-data.ts
@@ -0,0 +1,86 @@
+export type AgentTaskState = "waiting" | "failed" | "running" | "done";
+export type AgentColumnId = "needs-you" | "running" | "done";
+
+export interface AgentTask {
+  id: string;
+  title: string;
+  description: string;
+  state: AgentTaskState;
+  duration: string;
+  messages: number;
+  toolCalls: number;
+  detail: string;
+}
+
+export const agentColumns: { id: AgentColumnId; label: string }[] = [
+  { id: "needs-you", label: "Needs You" },
+  { id: "running", label: "Running" },
+  { id: "done", label: "Done" },
+];
+
+export function agentTaskColumn(state: AgentTaskState): AgentColumnId {
+  return state === "waiting" || state === "failed" ? "needs-you" : state;
+}
+
+export function resumeAgentTask(task: AgentTask): AgentTask {
+  if (task.state !== "waiting" && task.state !== "failed") return task;
+  return {
+    ...task,
+    state: "running",
+    duration: "0s",
+    detail: "Resumed in this local demo. No agent is connected and no external changes are being made.",
+  };
+}
+
+export const demoAgentTasks: AgentTask[] = [
+  {
+    id: "agent-migrate",
+    title: "Migrate users table",
+    description: "Split users into accounts and profiles on Postgres 17. The dry run is ready for review.",
+    state: "waiting",
+    duration: "6m 14s",
+    messages: 9,
+    toolCalls: 14,
+    detail: "The dry run is complete. Review the proposed split into accounts and profiles before approving the next step. Approval only moves this sample task to Running; it does not execute a database migration.",
+  },
+  {
+    id: "agent-crm",
+    title: "Clean up CRM contacts",
+    description: "Matched 1,312 likely duplicates, then the merge hit the API rate limit.",
+    state: "failed",
+    duration: "2m 08s",
+    messages: 2,
+    toolCalls: 6,
+    detail: "The sample merge stopped at an API rate limit. The proposed duplicate matches are available for review. Retry only changes the local demo state; no CRM records are modified.",
+  },
+  {
+    id: "agent-review",
+    title: "Review PR #482",
+    description: "Billing webhooks: reading the diff and the test run, writing review notes.",
+    state: "running",
+    duration: "3m 42s",
+    messages: 12,
+    toolCalls: 21,
+    detail: "Reviewing webhook signature validation, retry handling, and the latest test output. This is a static example of a running task, not a live pull request review.",
+  },
+  {
+    id: "agent-release",
+    title: "Release notes v2.4",
+    description: "Grouping 23 merged pull requests into features and fixes.",
+    state: "running",
+    duration: "1m 20s",
+    messages: 23,
+    toolCalls: 5,
+    detail: "Organizing the sample release into features, improvements, and fixes. No release is being published and no repository is connected.",
+  },
+  {
+    id: "agent-digest",
+    title: "Weekly metrics digest",
+    description: "Pulled numbers from three dashboards and posted the weekly summary.",
+    state: "done",
+    duration: "4m 12s",
+    messages: 3,
+    toolCalls: 8,
+    detail: "The sample digest summarizes three dashboards and their weekly changes. This completion is demo content; nothing has been posted to an external service.",
+  },
+];
--- /dev/null
+++ src/components/dashboard/agent-board-view.tsx
@@ -0,0 +1,68 @@
+"use client";
+
+import { useRef, useState } from "react";
+import { Check, RotateCcw } from "@/components/icons";
+import { Badge } from "@/components/ui/badge";
+import { Button } from "@/components/ui/button";
+import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
+import { AgentBoard, AgentTaskStatus } from "./agent-board";
+import { demoAgentTasks, resumeAgentTask, type AgentTask } from "./agent-board-data";
+
+export function AgentBoardView() {
+  const [tasks, setTasks] = useState(demoAgentTasks);
+  const [selectedId, setSelectedId] = useState<string | null>(null);
+  const [announcement, setAnnouncement] = useState("");
+  const triggerRef = useRef<HTMLElement | null>(null);
+  const lastOpenedId = useRef<string | null>(null);
+  const selected = tasks.find(task => task.id === selectedId);
+
+  const openTask = (task: AgentTask) => {
+    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
+    lastOpenedId.current = task.id;
+    setSelectedId(task.id);
+  };
+
+  const resumeSelected = () => {
+    if (!selected || (selected.state !== "waiting" && selected.state !== "failed")) return;
+    setTasks(current => current.map(task => task.id === selected.id ? resumeAgentTask(task) : task));
+    setAnnouncement(`${selected.title} moved to Running in this demo.`);
+  };
+
+  return (
+    <section aria-label="Agent Board" className="flex min-w-0 flex-col gap-4 pb-6">
+      <h1 className="sr-only">Agent Board</h1>
+      <AgentBoard tasks={tasks} onOpenTask={openTask} />
+      <p className="text-xs text-muted-foreground">Sample data · Changes last until you leave or reload this page.</p>
+      <p role="status" className="sr-only">{announcement}</p>
+      <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelectedId(null); }}>
+        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md" finalFocus={() => {
+          const currentTrigger = document.querySelector<HTMLElement>(`[data-agent-task="${lastOpenedId.current}"]`);
+          return currentTrigger ?? triggerRef.current;
+        }}>
+          {selected && <>
+            <DialogHeader>
+              <Badge variant="outline" className="w-fit">Demo task</Badge>
+              <DialogTitle className="pr-6">{selected.title}</DialogTitle>
+              <DialogDescription>{selected.description}</DialogDescription>
+            </DialogHeader>
+            <AgentTaskStatus task={selected} />
+            <p className="text-sm leading-relaxed text-muted-foreground">{selected.detail}</p>
+            <dl className="grid grid-cols-3 gap-3 text-sm">
+              <div><dt className="text-xs text-muted-foreground">Duration</dt><dd className="mt-1 tabular-nums">{selected.duration}</dd></div>
+              <div><dt className="text-xs text-muted-foreground">Messages</dt><dd className="mt-1 tabular-nums">{selected.messages}</dd></div>
+              <div><dt className="text-xs text-muted-foreground">Tool calls</dt><dd className="mt-1 tabular-nums">{selected.toolCalls}</dd></div>
+            </dl>
+            {(selected.state === "waiting" || selected.state === "failed") && (
+              <DialogFooter>
+                <Button onClick={resumeSelected}>
+                  {selected.state === "failed" ? <RotateCcw data-icon="inline-start" /> : <Check data-icon="inline-start" />}
+                  {selected.state === "failed" ? "Retry task" : "Approve & resume"}
+                </Button>
+              </DialogFooter>
+            )}
+          </>}
+        </DialogContent>
+      </Dialog>
+    </section>
+  );
+}
--- /dev/null
+++ src/components/dashboard/agent-board.tsx
@@ -0,0 +1,87 @@
+"use client";
+
+import { AlertCircle, AlertTriangle, Check, Loader2, MessageSquare, Settings, Sparkles } from "@/components/icons";
+import { Badge } from "@/components/ui/badge";
+import { cn } from "@/lib/utils";
+import { agentColumns, agentTaskColumn, type AgentColumnId, type AgentTask, type AgentTaskState } from "./agent-board-data";
+
+const stateLabels: Record<AgentTaskState, string> = {
+  waiting: "Waiting for you",
+  failed: "Failed",
+  running: "Running",
+  done: "Completed",
+};
+
+export function AgentTaskStatus({ task }: { task: AgentTask }) {
+  const Icon = task.state === "waiting" ? AlertTriangle
+    : task.state === "failed" ? AlertCircle
+    : task.state === "running" ? Loader2 : Check;
+
+  return (
+    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
+      <Icon className={cn("size-3 shrink-0", task.state === "running" && "motion-safe:animate-spin")} />
+      <span className="truncate">
+        {task.state === "waiting" ? `Waiting for you · ${task.duration}`
+          : task.state === "failed" ? "Failed" : task.duration}
+      </span>
+      {(task.state === "running" || task.state === "done") && <span className="sr-only">{stateLabels[task.state]}</span>}
+    </span>
+  );
+}
+
+export function AgentTaskCard({ task, onOpenTask }: { task: AgentTask; onOpenTask: (task: AgentTask) => void }) {
+  return (
+    <button
+      type="button"
+      data-agent-task={task.id}
+      aria-label={`Open ${task.title}`}
+      onClick={() => onOpenTask(task)}
+      className="group flex w-full min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-3 text-left text-card-foreground shadow-xs transition-colors hover:border-foreground/25 hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
+    >
+      <span className="flex min-w-0 items-center gap-2">
+        <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
+        <span className="truncate text-[13px] font-semibold tracking-tight">{task.title}</span>
+      </span>
+      <span className="line-clamp-2 text-[13px] leading-5 text-muted-foreground">{task.description}</span>
+      <span className="mt-0.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
+        <AgentTaskStatus task={task} />
+        <span className="inline-flex items-center gap-2 text-[11px] tabular-nums text-muted-foreground">
+          <span className="inline-flex items-center gap-1" aria-label={`${task.messages} messages`}><MessageSquare className="size-3" />{task.messages}</span>
+          <span aria-hidden="true" className="h-3 w-px bg-border" />
+          <span className="inline-flex items-center gap-1" aria-label={`${task.toolCalls} tool calls`}><Settings className="size-3" />{task.toolCalls}</span>
+        </span>
+      </span>
+    </button>
+  );
+}
+
+export function AgentBoardColumn({ id, label, tasks, onOpenTask }: {
+  id: AgentColumnId;
+  label: string;
+  tasks: AgentTask[];
+  onOpenTask: (task: AgentTask) => void;
+}) {
+  return (
+    <section aria-labelledby={`agent-column-${id}`} data-agent-column={id} className="min-w-0 rounded-2xl bg-muted/45 p-1">
+      <header className="flex h-9 items-center gap-2 px-2.5">
+        <Sparkles className="size-3 text-muted-foreground" />
+        <h2 id={`agent-column-${id}`} className="flex-1 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</h2>
+        <Badge variant="secondary" className="min-w-5 justify-center px-1.5" aria-label={`${label}: ${tasks.length} tasks`}>{tasks.length}</Badge>
+      </header>
+      <div className="flex flex-col gap-1">
+        {tasks.map(task => <AgentTaskCard key={task.id} task={task} onOpenTask={onOpenTask} />)}
+        {!tasks.length && <p className="px-3 py-8 text-center text-xs text-muted-foreground">No tasks here</p>}
+      </div>
+    </section>
+  );
+}
+
+export function AgentBoard({ tasks, onOpenTask }: { tasks: AgentTask[]; onOpenTask: (task: AgentTask) => void }) {
+  return (
+    <div aria-label="Agent task board" className="grid min-w-0 grid-cols-1 items-start gap-2 lg:grid-cols-3">
+      {agentColumns.map(column => (
+        <AgentBoardColumn key={column.id} {...column} tasks={tasks.filter(task => agentTaskColumn(task.state) === column.id)} onOpenTask={onOpenTask} />
+      ))}
+    </div>
+  );
+}
--- /dev/null
+++ scripts/check-agent-board.cjs
@@ -0,0 +1,119 @@
+// Run against the local dev service. Set PLAYWRIGHT_MODULE if Playwright is not installed locally.
+const assert = require("node:assert/strict");
+const fs = require("node:fs");
+const path = require("node:path");
+const os = require("node:os");
+function loadPlaywright() {
+  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
+  try { return require("playwright"); } catch {
+    const cache = path.join(os.homedir(), ".npm/_npx");
+    for (const entry of fs.readdirSync(cache)) {
+      const candidate = path.join(cache, entry, "node_modules/playwright");
+      if (fs.existsSync(candidate)) return require(candidate);
+    }
+    throw new Error("Install Playwright or set PLAYWRIGHT_MODULE to its installed directory.");
+  }
+}
+const { chromium } = loadPlaywright();
+const base = process.env.APP_URL || "http://127.0.0.1:3010";
+const output = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "agent-board-check");
+
+(async () => {
+  const browser = await chromium.launch({ args: ["--no-sandbox"] });
+  const results = [];
+  const errors = [];
+  try {
+    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
+    page.on("pageerror", error => errors.push(error.message));
+    await page.goto(base);
+    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
+    await page.getByRole("button", { name: "Agent Board", exact: true }).last().click();
+    await page.getByRole("heading", { name: "Agent Board", exact: true }).waitFor();
+    assert.match(page.url(), /route=agent-board/);
+    const column = id => page.locator(`[data-agent-column="${id}"]`);
+    const card = id => page.locator(`[data-agent-task="agent-${id}"]`);
+    const count = async (id, n) => assert.equal(await column(id).locator("[data-agent-task]").count(), n);
+    await count("needs-you", 2); await count("running", 2); await count("done", 1);
+    await page.getByLabel("Needs You: 2 tasks", { exact: true }).waitFor();
+    await page.getByLabel("Running: 2 tasks", { exact: true }).waitFor();
+    await page.getByLabel("Done: 1 tasks", { exact: true }).waitFor();
+    const order = await page.locator("nav:visible").first().getByRole("button").allTextContents();
+    assert.equal(order.findIndex(s => s.trim() === "Agent Board"), order.findIndex(s => s.trim() === "Home") + 1);
+    results.push("Initial cards, counts, sidebar position and route");
+    await page.reload();
+    await card("migrate").waitFor();
+    await page.getByRole("button", { name: "Home", exact: true }).last().click();
+    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
+    assert.equal(await page.getByRole("table").count(), 1);
+    await page.goBack(); await card("migrate").waitFor();
+    await page.goForward(); await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
+    await page.getByRole("button", { name: "Agent Board", exact: true }).last().click();
+    await card("migrate").waitFor();
+    results.push("Direct reload, back/forward and Home regression");
+
+    fs.mkdirSync(output, { recursive: true });
+    await page.screenshot({ path: path.join(output, "desktop-light.png") });
+    await page.evaluate(() => { localStorage.setItem("theme", "dark"); });
+    await page.reload(); await card("migrate").waitFor();
+    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("dark")), true);
+    await page.screenshot({ path: path.join(output, "desktop-dark.png") });
+    results.push("Light and dark initial layouts");
+
+    await card("migrate").focus(); await page.keyboard.press("Enter");
+    const dialog = page.getByRole("dialog");
+    await dialog.getByRole("heading", { name: "Migrate users table" }).waitFor();
+    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
+    assert.equal(await card("migrate").evaluate(el => el === document.activeElement), true);
+    await card("migrate").click();
+    await dialog.getByRole("button", { name: "Approve & resume" }).click();
+    await dialog.getByText("Resumed in this local demo.", { exact: false }).waitFor();
+    await count("needs-you", 1); await count("running", 3);
+    assert.equal(await dialog.getByRole("button", { name: "Approve & resume" }).count(), 0);
+    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
+    assert.equal(await card("migrate").evaluate(el => el === document.activeElement), true);
+    results.push("Keyboard detail, approval, fresh dialog state and focus restoration after move");
+
+    await card("crm").click(); await dialog.getByText("Failed", { exact: true }).waitFor();
+    await dialog.getByRole("button", { name: "Retry task" }).click();
+    await dialog.getByText("Resumed in this local demo.", { exact: false }).waitFor();
+    await count("needs-you", 0); await count("running", 4);
+    await column("needs-you").getByText("No tasks here").waitFor();
+    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
+    results.push("Failed task retry and empty column");
+
+    for (const id of ["review", "digest"]) {
+      await card(id).click();
+      await dialog.waitFor();
+      assert.equal(await dialog.getByRole("button", { name: /Approve|Retry/ }).count(), 0);
+      await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
+    }
+    results.push("Read-only running and done details");
+    await page.keyboard.press("Control+k");
+    await page.getByPlaceholder("Type a command or search...").fill("Agent Board");
+    await page.getByRole("option", { name: "Agent Board", exact: true }).click();
+    results.push("Command palette navigation");
+
+    await page.setViewportSize({ width: 390, height: 844 });
+    await page.reload(); await card("migrate").waitFor();
+    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
+    await page.screenshot({ path: path.join(output, "mobile-dark.png") });
+    await card("digest").click(); await dialog.waitFor();
+    const bounds = await dialog.boundingBox();
+    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 390);
+    await page.keyboard.press("Escape"); await dialog.waitFor({ state: "hidden" });
+    await page.getByRole("button", { name: "Toggle sidebar" }).click();
+    await page.getByRole("button", { name: "Home", exact: true }).first().click();
+    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
+    await page.getByRole("button", { name: "Toggle sidebar" }).click();
+    await page.getByRole("button", { name: "Agent Board", exact: true }).first().click();
+    await card("migrate").waitFor();
+    await page.evaluate(() => { localStorage.setItem("theme", "light"); });
+    await page.reload(); await card("migrate").waitFor();
+    await page.screenshot({ path: path.join(output, "mobile-light.png") });
+    results.push("Mobile navigation, stacked columns, dialog bounds and overflow");
+    assert.deepEqual(errors, []);
+    console.log(JSON.stringify({ passed: results, pageErrors: errors, screenshots: output }, null, 2));
+  } finally {
+    await browser.close();
+  }
+})().catch(error => { console.error(error); process.exitCode = 1; });

```

Report unmet acceptance criteria, broken rules, and bugs. Each finding: the location, what goes wrong, and evidence checked against the surrounding code. Output a Markdown list of findings only — no severity, priority, or ranking.

Review by inspection only. Do not modify code, run builds or tests, or invoke quality gates. Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

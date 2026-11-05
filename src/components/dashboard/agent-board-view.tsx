"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { AgentBoard } from "./agent-board";
import {
  bmadTaskToAgentTask,
  type AgentTask,
} from "./agent-board-data";
import { WorktreeTree } from "./worktree-tree";
import {
  demoWorktreeRun,
  bmadNodeToWorktreeNode,
  type WorktreeNode,
} from "./worktree-tree-data";
import { Kanban, GitBranch, Filter } from "@/components/icons";
import { Button } from "@/components/ui/button-clean";
import { FilterMenu } from "@/components/ui/filter-menu-clean";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";
import { apiFetch } from "@/lib/api";
import type { BMadAgentTreeNode, BMadTaskItem } from "@/lib/bmad";
import { useActiveProject } from "./project-context";
import "./search-filter-controls.css";

/** `"loading"` and `"error"` describe the first load; `"ready"` means the
 *  last response for the active project committed. Empty is `"ready"` with
 *  zero tasks — never a demo fixture standing in for the database. */
type LoadState = "loading" | "ready" | "error";

/**
 * Everything shown for one project, tagged with the project it came from.
 * The tag is what makes switching safe: a response (or a stale render) from
 * project A can never be read as project B's data, and no reset effect is
 * needed — state for a project the panel is no longer showing is simply not
 * current. `tasks: []` is a real answer, never a fixture.
 */
interface ProjectSnapshot {
  projectId: string;
  tasks: AgentTask[];
  worktreeRun: WorktreeNode | null;
  loadState: LoadState;
  lastSyncTime: string | null;
}

export function AgentBoardView() {
  const { projectId, project, status: projectStatus } = useActiveProject();
  const [snapshot, setSnapshot] = useState<ProjectSnapshot | null>(null);
  // Expansion and fold state are also per project: task ids repeat across
  // projects by design (TASK-101 may exist in both), so carrying A's open ids
  // into B would silently unfold a card the user never touched there.
  const [openState, setOpenState] = useState<{ projectId: string | null; ids: string[] }>({
    projectId: null,
    ids: [],
  });
  const [justMoved, setJustMoved] = useState<{ projectId: string; id: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [tab, setTab] = useState<"board" | "worktree">("board");
  const [worktreeSample, setWorktreeSample] = useState("live");

  const current = snapshot && snapshot.projectId === projectId ? snapshot : null;
  const tasks = current?.tasks ?? [];
  const worktreeRun = current?.worktreeRun ?? null;
  const loadState: LoadState = current?.loadState
    ?? (projectStatus === "error" ? "error" : "loading");
  const lastSyncTime = current?.lastSyncTime ?? null;
  const openIds = openState.projectId === projectId ? openState.ids : [];
  const justMovedId = justMoved && justMoved.projectId === projectId ? justMoved.id : null;

  // Latest active project, readable from async callbacks. Kept in a ref so a
  // response that started before a switch can tell it is no longer current.
  const projectIdRef = useRef<string | null>(projectId);
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // `syncingFor` instead of a boolean: "is this project loading" derives from
  // the active id, so a switch never needs a reset render to clear a spinner
  // left over from the previous project.
  const [syncingFor, setSyncingFor] = useState<string | null>(null);

  const loadProjectData = useCallback(async (id: string) => {
    const segment = encodeURIComponent(id);
    const isStale = () => projectIdRef.current !== id;
    setSyncingFor(id);
    try {
      const [tasksResult, treeResult] = await Promise.allSettled([
        apiFetch(`/api/projects/${segment}/tasks`, { cache: "no-store" }),
        apiFetch(`/api/projects/${segment}/agent-tree`, { cache: "no-store" }),
      ]);
      if (isStale()) return;

      let failed = false;
      let tasksLoaded = false;
      let treeLoaded = false;
      let nextTasks: AgentTask[] | null = null;
      let nextTree: WorktreeNode | null = null;

      if (tasksResult.status === "fulfilled" && tasksResult.value.ok) {
        const liveTasks: BMadTaskItem[] = await tasksResult.value.json();
        if (isStale()) return;
        // An empty list is a real answer: the project simply has no tasks.
        nextTasks = Array.isArray(liveTasks) ? liveTasks.map(bmadTaskToAgentTask) : [];
        tasksLoaded = true;
      } else {
        failed = true;
      }

      if (treeResult.status === "fulfilled" && treeResult.value.ok) {
        const liveTree: BMadAgentTreeNode | null = await treeResult.value.json();
        if (isStale()) return;
        nextTree = liveTree ? bmadNodeToWorktreeNode(liveTree) : null;
        treeLoaded = true;
      } else {
        failed = true;
      }

      if (isStale()) return;
      const committedTasks = nextTasks;
      const committedTree = nextTree;
      setSnapshot(previous => {
        // Keep whatever the other request already committed for this project
        // when only one half of the pair failed.
        const base = previous && previous.projectId === id ? previous : null;
        return {
          projectId: id,
          tasks: tasksLoaded ? committedTasks ?? [] : base?.tasks ?? [],
          worktreeRun: treeLoaded ? committedTree : base?.worktreeRun ?? null,
          loadState: failed ? "error" : "ready",
          lastSyncTime: new Date().toLocaleTimeString(),
        };
      });
    } catch (err) {
      if (isStale()) return;
      console.warn("[BMad Monitor] Gagal sinkronisasi data live:", err);
      setSnapshot(previous => (previous && previous.projectId === id
        ? { ...previous, loadState: "error" }
        : { projectId: id, tasks: [], worktreeRun: null, loadState: "error", lastSyncTime: null }));
    } finally {
      if (!isStale()) setSyncingFor(syncing => (syncing === id ? null : syncing));
    }
  }, []);

  // Initial fetch and auto-polling every 5 seconds. The effect depends on the
  // active project: switching tears down the old interval and starts one bound
  // to the new id — an interval holding the previous id would keep fetching
  // project A under project B's heading, a failure that looks right at first.
  useEffect(() => {
    if (!projectId) return;
    const id = projectId;
    const poll = () => {
      void loadProjectData(id);
    };
    // The effect body only registers timers; every state commit happens in a
    // timer callback, after the render it belongs to has been painted.
    const kickoff = setTimeout(poll, 0);
    const interval = setInterval(poll, 5000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, [projectId, loadProjectData]);

  useEffect(() => {
    if (!justMoved) return;
    const timer = setTimeout(() => setJustMoved(null), 900);
    return () => clearTimeout(timer);
  }, [justMoved]);

  const toggle = (id: string) => {
    if (!projectId) return;
    const owner = projectId;
    setOpenState(previous => {
      const ids = previous.projectId === owner ? previous.ids : [];
      return {
        projectId: owner,
        ids: ids.includes(id) ? ids.filter(item => item !== id) : [...ids, id],
      };
    });
  };

  const closeCard = (owner: string, id: string) => {
    setOpenState(previous => (previous.projectId === owner
      ? { projectId: owner, ids: previous.ids.filter(item => item !== id) }
      : previous));
  };

  const patchTaskLocally = (owner: string, id: string, patch: Partial<AgentTask>) => {
    setSnapshot(previous => (previous && previous.projectId === owner
      ? {
          ...previous,
          tasks: previous.tasks.map(item => (item.id === id ? { ...item, ...patch } : item)),
        }
      : previous));
  };

  const approve = async (id: string) => {
    if (!projectId) return;
    const owner = projectId;
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    // Optimistic UI update
    patchTaskLocally(owner, id, {
      state: "running",
      stage: "in_progress",
      approvalStatus: "approved",
      steps: [
        ...task.steps,
        { text: "Disetujui oleh reviewer di Web Dashboard", time: "sekarang" },
      ],
    });
    closeCard(owner, id);
    setJustMoved({ projectId: owner, id });
    setAnnouncement(`${task.title} disetujui dan dialihkan ke Running.`);

    // Persist to the active workspace's project — the same one the board shows.
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(owner)}/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "in_progress",
          approvalStatus: "approved",
          addStep: "Disetujui oleh reviewer di Web Dashboard",
        }),
      });
      // apiFetch only resolves the transport; a 4xx/5xx is a resolved response.
      // Without this check the optimistic card would silently agree to a write
      // that never happened.
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void loadProjectData(owner);
    } catch (err) {
      console.error("[BMad Monitor] Gagal memperbarui status approval:", err);
      void loadProjectData(owner);
      setAnnouncement(`Gagal menyetujui ${task.title}. Perubahan dibatalkan.`);
    }
  };

  const reject = async (id: string) => {
    if (!projectId) return;
    const owner = projectId;
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    const reason = window.prompt("Masukkan alasan penolakan (opsional):", "") || "Ditolak dari Web Dashboard";

    // Optimistic UI update
    patchTaskLocally(owner, id, {
      state: "failed",
      stage: "rejected",
      approvalStatus: "rejected",
      rejectionReason: reason,
      steps: [
        ...task.steps,
        { text: `Ditolak oleh reviewer: ${reason}`, time: "sekarang" },
      ],
    });
    closeCard(owner, id);
    setAnnouncement(`${task.title} ditolak.`);

    // Persist to the active workspace's project — the same one the board shows.
    try {
      const res = await apiFetch(`/api/projects/${encodeURIComponent(owner)}/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "rejected",
          approvalStatus: "rejected",
          rejectionReason: reason,
          addStep: `Ditolak oleh reviewer: ${reason}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      void loadProjectData(owner);
    } catch (err) {
      console.error("[BMad Monitor] Gagal menolak task:", err);
      void loadProjectData(owner);
      setAnnouncement(`Gagal menolak ${task.title}. Perubahan dibatalkan.`);
    }
  };

  const emptyMessage = !projectId
    ? projectStatus === "error"
      ? "Gagal memuat daftar workspace. Coba muat ulang halaman."
      : projectStatus === "ready"
        ? "Belum ada workspace terdaftar."
        : "Memuat workspace…"
    : loadState === "loading"
      ? "Memuat task workspace…"
      : loadState === "error"
        ? "Gagal memuat task workspace ini. Periksa koneksi database lalu tekan Refresh."
        : `Belum ada task di workspace ${project?.name ?? "ini"}. Task yang dilaporkan agent akan muncul di sini.`;

  // Only the board's own emptiness belongs here. The worktree tab has its own
  // message below; rendering both at once tells the user two different things
  // about one project.
  const showEmptyMessage = !projectId || loadState === "loading" || loadState === "error" || tasks.length === 0;
  const worktreeEmptyMessage = loadState === "loading"
    ? "Memuat pohon agen…"
    : loadState === "error"
      ? "Gagal memuat pohon agen workspace ini."
      : `Belum ada pohon agen di workspace ${project?.name ?? "ini"}.`;

  return (
    <section aria-label="Agent Board" className="flex min-w-0 flex-col gap-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="sr-only">Agent Board</h1>
        <SegmentedControl
          variant="tray"
          size="sm"
          kind="tabs"
          aria-label="Agent Board view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "board", label: "Board", icon: <Kanban />, controls: "agent-board-panel" },
            { value: "worktree", label: "Worktree", icon: <GitBranch />, controls: "agent-worktree-panel" },
          ]}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={`inline-block size-2 rounded-full ${
              syncingFor === projectId && projectId !== null ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
            aria-hidden="true"
          />
          <span>BMad Monitor Live Sync</span>
          {project && <span className="text-[11px] opacity-75">· {project.name}</span>}
          {lastSyncTime && <span className="text-[11px] opacity-75">· {lastSyncTime}</span>}
          <button
            type="button"
            onClick={() => { if (projectId) void loadProjectData(projectId); }}
            className="ms-1 cursor-pointer underline hover:text-foreground"
            title="Muat ulang data BMad"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div
          id="agent-board-panel"
          role="tabpanel"
          aria-labelledby="agent-board-panel-tab"
          tabIndex={0}
          hidden={tab !== "board"}
          className="mt-2 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {showEmptyMessage && (
            <p role="status" className="mb-2 rounded-[10px] bg-muted/50 px-3 py-6 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </p>
          )}
          {tab === "board" && (
            <AgentBoard
              tasks={tasks}
              openIds={openIds}
              justMovedId={justMovedId}
              onToggle={toggle}
              onApprove={approve}
              onReject={reject}
            />
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            Terhubung langsung ke database BMad Monitor · Perubahan Approve/Reject langsung terbaca oleh sesi agent di T3 Code CLI.
          </p>
        </div>

        <div
          id="agent-worktree-panel"
          role="tabpanel"
          aria-labelledby="agent-worktree-panel-tab"
          tabIndex={0}
          hidden={tab !== "worktree"}
          className="mt-2 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <div className="search-filter-controls mb-4">
            <Popover>
              <PopoverTrigger render={<Button size="lg" variant="secondary" className="search-filter-trigger" icon={<Filter />} aria-label="Demo scenario" />}>
                {worktreeSample === "live" ? "BMad live tree · database" : "Pricing page · 3 branches"}
              </PopoverTrigger>
              <PopoverContent unstyled align="start" className="search-filter-popover">
                <PopoverTitle className="sr-only">Choose demo scenario</PopoverTitle>
                <FilterMenu title="Demo scenario" selectionMode="single"
                  groups={[{ id: "scenario", label: "Scenario", options: [
                    { id: "live", label: "BMad live tree · database" },
                    { id: "pricing", label: "Pricing page · 3 branches" },
                  ] }]}
                  value={{ scenario: [worktreeSample] }}
                  onChange={value => { if (value.scenario?.[0]) setWorktreeSample(value.scenario[0]); }} />
              </PopoverContent>
            </Popover>
          </div>

          {tab === "worktree" && (worktreeSample === "live"
            ? worktreeRun
              // Keyed by project so the tree's open/focus state resets on a switch.
              ? <WorktreeTree key={`live-${projectId ?? "none"}`} run={worktreeRun} />
              : (
                <p role="status" className="rounded-[10px] bg-muted/50 px-3 py-8 text-center text-xs text-muted-foreground">
                  {worktreeEmptyMessage}
                </p>
              )
            : <WorktreeTree key={`pricing-${projectId ?? "none"}`} run={demoWorktreeRun} />)}
          <p className="mt-4 text-xs text-muted-foreground">
            Pohon agen BMad Monitor real-time · Metrik Token Usage (input, output, cache) dilaporkan secara otomatis oleh sub-agent.
          </p>
        </div>
      </div>
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}

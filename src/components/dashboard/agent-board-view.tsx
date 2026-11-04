"use client";

import { useEffect, useState, useCallback } from "react";
import { AgentBoard } from "./agent-board";
import {
  demoAgentTasks,
  bmadTaskToAgentTask,
  type AgentTask,
} from "./agent-board-data";
import { WorktreeTree } from "./worktree-tree";
import {
  demoWorktreeRun,
  bmadNodeToWorktreeNode,
  type WorktreeNode,
} from "./worktree-tree-data";
import { Kanban, GitBranch } from "@/components/icons";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";
import type { BMadAgentTreeNode, BMadTaskItem } from "@/lib/bmad";

export function AgentBoardView() {
  const [tasks, setTasks] = useState<AgentTask[]>(demoAgentTasks);
  const [worktreeRun, setWorktreeRun] = useState<WorktreeNode>(demoWorktreeRun);
  const [openIds, setOpenIds] = useState<string[]>(["TASK-101", "agent-migrate"]);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [tab, setTab] = useState<"board" | "worktree">("board");
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const fetchLiveBMadData = useCallback(async () => {
    try {
      const [tasksRes, treeRes] = await Promise.all([
        fetch("/api/projects/prj_default/tasks", { cache: "no-store" }),
        fetch("/api/projects/prj_default/agent-tree", { cache: "no-store" }),
      ]);

      if (tasksRes.ok) {
        const liveTasks: BMadTaskItem[] = await tasksRes.json();
        if (Array.isArray(liveTasks) && liveTasks.length > 0) {
          const mapped = liveTasks.map(bmadTaskToAgentTask);
          setTasks(mapped);
        }
      }

      if (treeRes.ok) {
        const liveTree: BMadAgentTreeNode | null = await treeRes.json();
        if (liveTree) {
          const mappedTree = bmadNodeToWorktreeNode(liveTree);
          setWorktreeRun(mappedTree);
        }
      }
      setLastSyncTime(new Date().toLocaleTimeString());
    } catch (err) {
      console.warn("[BMad Monitor] Gagal sinkronisasi data live:", err);
    }
  }, []);

  // Initial fetch and auto-polling every 5 seconds for BMad CLI Agent updates
  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        setIsLiveSyncing(true);
        const [tasksRes, treeRes] = await Promise.all([
          fetch("/api/projects/prj_default/tasks", { cache: "no-store" }),
          fetch("/api/projects/prj_default/agent-tree", { cache: "no-store" }),
        ]);

        if (!ignore && tasksRes.ok) {
          const liveTasks: BMadTaskItem[] = await tasksRes.json();
          if (Array.isArray(liveTasks) && liveTasks.length > 0) {
            setTasks(liveTasks.map(bmadTaskToAgentTask));
          }
        }

        if (!ignore && treeRes.ok) {
          const liveTree: BMadAgentTreeNode | null = await treeRes.json();
          if (liveTree) {
            setWorktreeRun(bmadNodeToWorktreeNode(liveTree));
          }
        }
        if (!ignore) {
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } catch (err) {
        console.warn("[BMad Monitor] Gagal sinkronisasi data live:", err);
      } finally {
        if (!ignore) {
          setIsLiveSyncing(false);
        }
      }
    };

    void run();
    const interval = setInterval(run, 5000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!justMovedId) return;
    const timer = setTimeout(() => setJustMovedId(null), 900);
    return () => clearTimeout(timer);
  }, [justMovedId]);

  const toggle = (id: string) =>
    setOpenIds(current =>
      current.includes(id) ? current.filter(item => item !== id) : [...current, id]
    );

  const approve = async (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    // Optimistic UI update
    setTasks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              state: "running",
              stage: "in_progress",
              approvalStatus: "approved",
              steps: [
                ...item.steps,
                { text: "Disetujui oleh reviewer di Web Dashboard", time: "sekarang" },
              ],
            }
          : item
      )
    );
    setOpenIds(current => current.filter(item => item !== id));
    setJustMovedId(id);
    setAnnouncement(`${task.title} disetujui dan dialihkan ke Running.`);

    // Persist to backend database for BMad Monitor MCP CLI
    try {
      await fetch(`/api/projects/prj_default/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "in_progress",
          approvalStatus: "approved",
          addStep: "Disetujui oleh reviewer di Web Dashboard",
        }),
      });
      fetchLiveBMadData();
    } catch (err) {
      console.error("[BMad Monitor] Gagal memperbarui status approval:", err);
    }
  };

  const reject = async (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;

    const reason = window.prompt("Masukkan alasan penolakan (opsional):", "") || "Ditolak dari Web Dashboard";

    // Optimistic UI update
    setTasks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              state: "failed",
              stage: "rejected",
              approvalStatus: "rejected",
              rejectionReason: reason,
              steps: [
                ...item.steps,
                { text: `Ditolak oleh reviewer: ${reason}`, time: "sekarang" },
              ],
            }
          : item
      )
    );
    setOpenIds(current => current.filter(item => item !== id));
    setAnnouncement(`${task.title} ditolak.`);

    // Persist to backend database
    try {
      await fetch(`/api/projects/prj_default/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: "rejected",
          approvalStatus: "rejected",
          rejectionReason: reason,
          addStep: `Ditolak oleh reviewer: ${reason}`,
        }),
      });
      fetchLiveBMadData();
    } catch (err) {
      console.error("[BMad Monitor] Gagal menolak task:", err);
    }
  };

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
              isLiveSyncing ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
            }`}
            aria-hidden="true"
          />
          <span>BMad Monitor Live Sync</span>
          {lastSyncTime && <span className="text-[11px] opacity-75">· {lastSyncTime}</span>}
          <button
            type="button"
            onClick={() => fetchLiveBMadData()}
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
          {tab === "worktree" && <WorktreeTree run={worktreeRun} />}
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

"use client";

import { useEffect, useState } from "react";
import { AgentBoard } from "./agent-board";
import { demoAgentTasks, resumeAgentTask, type AgentTask } from "./agent-board-data";
import { WorktreeTree } from "./worktree-tree";
import { bmadWorktreeRun, demoWorktreeRun } from "./worktree-tree-data";
import { Kanban, GitBranch, Filter } from "@/components/icons";
import { Button } from "@/components/ui/button-clean";
import { FilterMenu } from "@/components/ui/filter-menu-clean";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import "./search-filter-controls.css";
import { SegmentedControl } from "@/components/ui/segmented-control-clean";

export function AgentBoardView() {
  const [tasks, setTasks] = useState<AgentTask[]>(demoAgentTasks);
  const [openIds, setOpenIds] = useState<string[]>(["agent-migrate"]);
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [tab, setTab] = useState<"board" | "worktree">("board");
  const [worktreeSample, setWorktreeSample] = useState("bmad");

  useEffect(() => {
    if (!justMovedId) return;
    const timer = setTimeout(() => setJustMovedId(null), 900);
    return () => clearTimeout(timer);
  }, [justMovedId]);

  const toggle = (id: string) =>
    setOpenIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);

  const approve = (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task || (task.state !== "waiting" && task.state !== "failed")) return;
    setTasks(current => current.map(item => item.id === id ? resumeAgentTask(item) : item));
    setOpenIds(current => current.filter(item => item !== id));
    setJustMovedId(id);
    setAnnouncement(`${task.title} moved to Running in this demo.`);
  };

  const reject = (id: string) => {
    const task = tasks.find(item => item.id === id);
    if (!task) return;
    setTasks(current => current.filter(item => item.id !== id));
    setOpenIds(current => current.filter(item => item !== id));
    setAnnouncement(`${task.title} dismissed from the demo board.`);
  };

  return (
    <section aria-label="Agent Board" className="flex min-w-0 flex-col gap-4 pb-6">
      <h1 className="sr-only">Agent Board</h1>
      <div className="min-w-0">
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
        <div id="agent-board-panel" role="tabpanel" aria-labelledby="agent-board-panel-tab" tabIndex={0} hidden={tab !== "board"} className="mt-4 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {tab === "board" && <AgentBoard tasks={tasks} openIds={openIds} justMovedId={justMovedId} onToggle={toggle} onApprove={approve} onReject={reject} />}
          <p className="mt-4 text-xs text-muted-foreground">Sample data · Changes last until you leave or reload this page.</p>
        </div>
        <div id="agent-worktree-panel" role="tabpanel" aria-labelledby="agent-worktree-panel-tab" tabIndex={0} hidden={tab !== "worktree"} className="mt-4 min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <div className="search-filter-controls mb-4">
            <Popover>
              <PopoverTrigger render={<Button size="lg" variant="secondary" className="search-filter-trigger" icon={<Filter />} aria-label="Demo scenario" />}>
                {worktreeSample === "bmad" ? "BMad sprint · 2 branches" : "Pricing page · 3 branches"}
              </PopoverTrigger>
              <PopoverContent unstyled align="start" className="search-filter-popover">
                <PopoverTitle className="sr-only">Choose demo scenario</PopoverTitle>
                <FilterMenu title="Demo scenario" selectionMode="single"
                  groups={[{ id: "scenario", label: "Scenario", options: [
                    { id: "bmad", label: "BMad sprint · 2 branches" },
                    { id: "pricing", label: "Pricing page · 3 branches" },
                  ] }]}
                  value={{ scenario: [worktreeSample] }}
                  onChange={value => { if (value.scenario?.[0]) setWorktreeSample(value.scenario[0]); }} />
              </PopoverContent>
            </Popover>
          </div>
          {tab === "worktree" && <WorktreeTree key={worktreeSample} run={worktreeSample === "bmad" ? bmadWorktreeRun : demoWorktreeRun} />}
          <p className="mt-4 text-xs text-muted-foreground">Sample data · This run tree is a local demo — no agents execute.</p>
        </div>
      </div>
      <p role="status" className="sr-only">{announcement}</p>
    </section>
  );
}

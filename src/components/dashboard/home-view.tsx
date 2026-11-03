"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TaskSummaryCard } from "./task-summary-card";
import { TaskOverview, TaskStatusBadge } from "./task-overview";
import { demoTasks, formatTaskDate, taskStatuses, taskStatusIcons, type Task } from "./task-data";

const HomeCharts = dynamic(() => import("./home-charts").then(module => module.HomeCharts), {
  ssr: false,
  loading: () => <div className="@container" role="status" aria-label="Loading task charts"><div className="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
    {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-72 w-full rounded-xl" />)}
  </div></div>,
});

const weeklyChanges = { "Kick-off": 4, "In-Production": 2, Completed: 2, Overtime: -2 };

export function HomeView() {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <section aria-label="Task dashboard" className="flex min-w-0 flex-col gap-4 pb-6">
      <h1 className="sr-only">Home</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {taskStatuses.map(status => (
          <TaskSummaryCard
            key={status}
            label={status}
            count={demoTasks.filter(task => task.status === status).length}
            change={weeklyChanges[status]}
            icon={taskStatusIcons[status]}
            description={`${status} task count compared with last week. These are sample tasks for the demo workspace.`}
            highlighted={status === "Kick-off"}
          />
        ))}
      </div>
      <HomeCharts tasks={demoTasks} />
      <TaskOverview tasks={demoTasks} onOpenTask={setSelectedTask} />
      <p className="text-xs text-muted-foreground">Sample data · Oct 30, 2026</p>
      <Dialog open={selectedTask !== null} onOpenChange={open => { if (!open) setSelectedTask(null); }}>
        <DialogContent className="sm:max-w-md">
          {selectedTask && <>
            <DialogHeader>
              <p className="text-[10px] text-neutral-500">{selectedTask.id} · {selectedTask.project}</p>
              <DialogTitle className="pr-5 leading-snug">{selectedTask.title}</DialogTitle>
              <DialogDescription>{selectedTask.description}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-4 border-t border-neutral-200 pt-4 text-[12px] dark:border-neutral-800">
              <div><dt className="mb-1.5 text-[10px] text-neutral-500">Status</dt><dd><TaskStatusBadge status={selectedTask.status} /></dd></div>
              <div><dt className="mb-1.5 text-[10px] text-neutral-500">Assignee</dt><dd>{selectedTask.assignee.name}</dd></div>
              <div><dt className="mb-1.5 text-[10px] text-neutral-500">Priority</dt><dd>{selectedTask.priority}</dd></div>
              <div><dt className="mb-1.5 text-[10px] text-neutral-500">Due date</dt><dd><time dateTime={selectedTask.dueDate}>{formatTaskDate(selectedTask.dueDate)}, 2026</time></dd></div>
            </dl>
          </>}
        </DialogContent>
      </Dialog>
    </section>
  );
}

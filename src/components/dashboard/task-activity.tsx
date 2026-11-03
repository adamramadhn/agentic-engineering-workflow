"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TaskPanel } from "./task-panel";
import { demoActivity, formatTaskDate, taskDueLabel, type Task } from "./task-data";

interface TaskActivityProps {
  tasks: Task[];
  onOpenTask: (task: Task) => void;
}

export function UpcomingDeadlines({ tasks, onOpenTask }: TaskActivityProps) {
  const upcoming = tasks.filter(task => task.status !== "Completed").toSorted((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 4);
  return (
    <TaskPanel title="Deadlines" action={<Badge variant="outline">{upcoming.length} tasks</Badge>}>
      <ul className="px-3">
        {upcoming.map((task, index) => (
          <li key={task.id}>
            {index > 0 && <Separator />}
            <div className="flex items-center gap-3 py-3">
              <div className="flex min-w-12 flex-col items-center gap-0.5 rounded-lg border bg-muted/40 px-2 py-1.5"><time dateTime={task.dueDate} className="text-xs text-muted-foreground">{formatTaskDate(task.dueDate)}</time></div>
              <div className="min-w-0 flex-1"><Button variant="link" onClick={() => onOpenTask(task)} className="h-auto max-w-full justify-start p-0"><span className="truncate">{task.title}</span></Button><p className="mt-1 truncate text-xs text-muted-foreground">{task.project}</p></div>
              <Badge variant="secondary">{taskDueLabel(task.dueDate)}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </TaskPanel>
  );
}

export function RecentTaskActivity({ tasks, onOpenTask }: TaskActivityProps) {
  return (
    <TaskPanel title="Activity" action={<Badge variant="outline">Today</Badge>}>
      <ul className="px-3">
        {demoActivity.map((activity, index) => {
          const task = tasks.find(task => task.id === activity.taskId);
          if (!task) return null;
          return (
            <li key={activity.id}>
              {index > 0 && <Separator />}
              <div className="flex items-start gap-3 py-3">
                <Avatar className="mt-0.5 size-7"><AvatarFallback>{task.assignee.initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground"><span className="text-foreground">{task.assignee.name}</span> {activity.action}</p><Button variant="link" onClick={() => onOpenTask(task)} className="mt-1 h-auto max-w-full justify-start p-0"><span className="truncate">{task.title}</span></Button></div>
                <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{activity.time}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </TaskPanel>
  );
}

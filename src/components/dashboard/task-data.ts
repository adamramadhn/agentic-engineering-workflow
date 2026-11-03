import { CircleCheck, Clapperboard, Play, TriangleAlert } from "@/components/icons";

export const taskStatuses = ["Kick-off", "In-Production", "Completed", "Overtime"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export interface Task {
  id: string;
  title: string;
  project: string;
  assignee: { name: string; initials: string };
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
  dueDate: string;
  description: string;
}

export const taskStatusIcons = {
  "Kick-off": Play,
  "In-Production": Clapperboard,
  Completed: CircleCheck,
  Overtime: TriangleAlert,
};

export const demoToday = "2026-10-30";

const projects = ["Website redesign", "Brand identity", "Product launch", "Mobile experience"];
const assignees = [
  { name: "Alex Morgan", initials: "AM" },
  { name: "Jordan Lee", initials: "JL" },
  { name: "Sam Taylor", initials: "ST" },
  { name: "Casey Chen", initials: "CC" },
];
const titles: Record<TaskStatus, string[]> = {
  "Kick-off": ["Define project scope", "Gather visual references", "Plan stakeholder workshop", "Write creative brief", "Map the customer journey"],
  "In-Production": ["Design landing page", "Build component library", "Prepare campaign assets", "Refine mobile navigation", "Review prototype feedback"],
  Completed: ["Approve wireframes", "Finalize typography", "Deliver logo exploration", "Document design principles"],
  Overtime: ["Review homepage concepts", "Approve launch copy", "Resolve accessibility feedback", "Hand off social templates", "Complete design QA"],
};
const counts: Record<TaskStatus, number> = { "Kick-off": 15, "In-Production": 10, Completed: 8, Overtime: 5 };

// Local demo data, anchored to the displayed week so server and client render identically.
export const demoTasks: Task[] = taskStatuses.flatMap((status, statusIndex) =>
  Array.from({ length: counts[status] }, (_, index) => {
    const projectIndex = (index + statusIndex) % projects.length;
    const date = new Date(`${demoToday}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + (status === "Overtime" ? -(index + 1) : status === "Completed" ? -index : index % 8));
    return {
      id: `TSK-${String(101 + taskStatuses.slice(0, statusIndex).reduce((total, key) => total + counts[key], 0) + index)}`,
      title: titles[status][index % titles[status].length],
      project: projects[projectIndex],
      assignee: assignees[(index + statusIndex) % assignees.length],
      status,
      priority: (["High", "Medium", "Low"] as const)[index % 3],
      dueDate: date.toISOString().slice(0, 10),
      description: `Coordinate ${titles[status][index % titles[status].length].toLowerCase()} for ${projects[projectIndex].toLowerCase()}. Review the deliverable with the team and capture feedback before the next handoff.`,
    };
  })
);

export function formatTaskDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function taskDueLabel(date: string) {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${demoToday}T12:00:00Z`)) / 86400000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatTaskDate(date);
}

export const demoActivity = [
  { id: "activity-1", taskId: "TSK-126", action: "completed a task", time: "12 min ago" },
  { id: "activity-2", taskId: "TSK-116", action: "moved a task to production", time: "38 min ago" },
  { id: "activity-3", taskId: "TSK-102", action: "picked up a new task", time: "1 hour ago" },
  { id: "activity-4", taskId: "TSK-127", action: "completed a task", time: "2 hours ago" },
];
